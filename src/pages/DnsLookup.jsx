import { useState, useCallback, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  Globe,
  Search,
  Copy,
  Check,
  Network,
  CircleX,
  Loader2,
  ShieldCheck,
  KeyRound,
} from 'lucide-react'
import { SyncLoader } from 'react-spinners'
import PageHeader from '../components/ui/PageHeader'
import { getRequest } from '../api/apiClient'
import { TOOL_CACHE_KEYS, saveToolCache, loadToolCache } from '../utils/toolResultCache'

// Cloudflare's public DNS-over-HTTPS resolver — queried directly from the
// browser. No server, no logs.
const DOH_URL = 'https://cloudflare-dns.com/dns-query'
const LIVE_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'PTR', 'SRV', 'CAA', 'DS', 'DNSKEY']

function isValidHostname(h) {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(h)
}

function normaliseHostname(raw) {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

function stripTrailingDot(s = '') {
  return s.replace(/\.$/, '')
}

async function queryDoh(name, type, signal) {
  const { data, success, error } = await getRequest(
    DOH_URL,
    { name, type },
    { Accept: 'application/dns-json' },
    { signal }
  )

  if (!success) {
    const status = error?.response?.status
    throw new Error(status ? `DoH HTTP ${status}` : error?.message ?? 'DoH request failed')
  }

  return data
}

async function fetchLiveDnsRecords(domain, signal) {
  const settled = await Promise.allSettled(
    LIVE_RECORD_TYPES.map(type => queryDoh(domain, type, signal).then(data => ({ type, data })))
  )
  const results = {}
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      const { type, data } = outcome.value
      results[type] = data.Answer ?? []
    }
  }
  // Resolve every MX host to its IPs so they show up in the MX table.
  results.MX_IPS = await resolveMxHosts(results.MX ?? [], signal)
  return results
}

// MX answers look like "10 smtp.google.com." — pull out the unique, lowercase
// hostnames (skipping the null-MX "0 ." case).
function getMxHosts(mxAnswers) {
  const hosts = mxAnswers
    .map(a => stripTrailingDot((a.data ?? '').split(' ').slice(1).join(' ')).toLowerCase())
    .filter(Boolean)
  return [...new Set(hosts)]
}

// Returns { 'smtp.google.com': ['142.250.x.x', '2a00:...'], ... }
async function resolveMxHosts(mxAnswers, signal) {
  const hosts = getMxHosts(mxAnswers)
  const entries = await Promise.all(
    hosts.map(async host => {
      const settled = await Promise.allSettled([
        queryDoh(host, 'A', signal),
        queryDoh(host, 'AAAA', signal),
      ])
      const ips = []
      for (const outcome of settled) {
        if (outcome.status !== 'fulfilled') continue
        // Answers can include a CNAME chain; only keep A (1) / AAAA (28) data.
        for (const a of outcome.value.Answer ?? []) {
          if ((a.type === 1 || a.type === 28) && a.data) ips.push(a.data)
        }
      }
      return [host, [...new Set(ips)]]
    })
  )
  return Object.fromEntries(entries)
}

// Cloudflare's DoH JSON returns each answer's value as a single presentation-
// format string (e.g. "10 smtp.google.com." for MX, or a space-separated
// SOA/DS/DNSKEY payload). This breaks each record type's raw `data` string
// into the same structured columns a real DNS table shows (dnschecker.org-
// style) instead of one opaque blob per row.
function parseRecordRow(type, entry, domain, mxIps) {
  const name = stripTrailingDot(entry.name || domain)
  const ttl = entry.TTL
  const data = entry.data ?? ''
  const base = { Type: type, 'Domain Name': name, TTL: ttl }

  switch (type) {
    case 'A':
    case 'AAAA':
      return { ...base, Address: data }

    case 'CNAME':
    case 'NS':
    case 'PTR':
      return { ...base, 'Canonical Name': stripTrailingDot(data) }

    case 'MX': {
      const [preference, ...rest] = data.split(' ')
      const host = stripTrailingDot(rest.join(' '))
      const row = { ...base, Preference: preference, Address: host }
      // Older cached results have no MX_IPS, so only add the column when present.
      if (mxIps) row['IP Address'] = (mxIps[host.toLowerCase()] ?? []).join('\n') || 'Not found'
      return row
    }

    case 'SRV': {
      const [priority, weight, port, ...target] = data.split(' ')
      return { ...base, Priority: priority, Weight: weight, Port: port, Target: stripTrailingDot(target.join(' ')) }
    }

    case 'SOA': {
      const [mname, rname, serial, refresh, retry, expire] = data.split(' ')
      return {
        ...base,
        'Primary NS': stripTrailingDot(mname),
        'Responsible Email': stripTrailingDot(rname),
        Serial: serial,
        Refresh: refresh,
        Retry: retry,
        Expire: expire,
      }
    }

    case 'TXT':
      // Long TXT records arrive as multiple quoted chunks: "part1" "part2"
      return { ...base, Record: data.replace(/^"|"$/g, '').replace(/"\s*"/g, '') }

    case 'CAA':
      return { ...base, Record: data }

    case 'DS': {
      const [keyTag, algorithm, digestType, ...digest] = data.split(' ')
      return { ...base, 'Key Tag': keyTag, Algorithm: algorithm, 'Digest Type': digestType, Digest: digest.join(' ') }
    }

    case 'DNSKEY': {
      const [flags, protocol, algorithm, ...publicKey] = data.split(' ')
      return { ...base, Flags: flags, Protocol: protocol, Algorithm: algorithm, 'Public Key': publicKey.join(' ') }
    }

    default:
      return { ...base, Record: data }
  }
}

// ── DMARC & DKIM ────────────────────────────────────────────────────────────
// DMARC lives at a fixed name (_dmarc.<domain>), so it's always queried.
// DKIM lives at <selector>._domainkey.<domain> and DNS can't list selectors,
// so user either query the selector the person typed, or — when the field is
// left empty — probe a list of commonly used selectors and show whichever
// ones exist.
const COMMON_DKIM_SELECTORS = [
  'default', 'google', 'selector1', 'selector2', 'k1', 'k2', 'k3',
  's1', 's2', 'mail', 'dkim', 'smtp', 'mandrill', 'protonmail',
  'protonmail2', 'protonmail3', 'zmail', 'mxvault',
]

function normaliseSelector(raw) {
  let s = raw.trim().toLowerCase()
  // Accept a pasted full DKIM name such as "google._domainkey.example.com"
  const idx = s.indexOf('._domainkey')
  if (idx > -1) s = s.slice(0, idx)
  return s
}

function isValidSelector(s) {
  return /^[a-z0-9_](?:[a-z0-9._-]{0,61}[a-z0-9_])?$/.test(s)
}

// TXT answers arrive as one or more quoted chunks: "part1" "part2"
function joinTxtChunks(data = '') {
  return data.replace(/^"|"$/g, '').replace(/"\s*"/g, '')
}

// "v=DMARC1; p=none; rua=mailto:x@y.com" -> { v: 'DMARC1', p: 'none', rua: '...' }
function parseTagList(record) {
  const tags = {}
  for (const part of record.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    tags[trimmed.slice(0, eq).trim().toLowerCase()] = trimmed.slice(eq + 1).trim()
  }
  return tags
}

function toTxtRecords(answers) {
  return answers
    .filter(a => a.type === 16)
    .map(a => ({ ttl: a.TTL, data: joinTxtChunks(a.data ?? '') }))
}

async function fetchDmarc(domain, signal) {
  const name = `_dmarc.${domain}`
  try {
    const data = await queryDoh(name, 'TXT', signal)
    const records = toTxtRecords(data.Answer ?? []).filter(r => /^\s*v=DMARC1/i.test(r.data))
    return { name, records, error: null }
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'CanceledError') throw err
    return { name, records: [], error: err.message ?? 'DMARC lookup failed' }
  }
}

async function fetchDkimSelector(domain, selector, signal) {
  const name = `${selector}._domainkey.${domain}`
  try {
    const data = await queryDoh(name, 'TXT', signal)
    const answers = data.Answer ?? []
    // Many providers (e.g. Microsoft 365) CNAME the selector to the real key.
    const cname = answers.find(a => a.type === 5)
    const records = toTxtRecords(answers)
      .filter(r => /(?:^|;)\s*(?:v=DKIM1|k=[a-z0-9]+|p=)/i.test(r.data))
      .map(r => ({ ...r, cname: cname ? stripTrailingDot(cname.data) : null }))
    return { selector, name, records, error: null }
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'CanceledError') throw err
    return { selector, name, records: [], error: err.message ?? 'DKIM lookup failed' }
  }
}

async function fetchEmailAuthRecords(domain, selector, signal) {
  const probing = !selector
  const selectors = probing ? COMMON_DKIM_SELECTORS : [selector]
  const [dmarc, dkimAll] = await Promise.all([
    fetchDmarc(domain, signal),
    Promise.all(selectors.map(sel => fetchDkimSelector(domain, sel, signal))),
  ])
  // When probing, only keep the selectors that actually exist.
  const dkim = probing ? dkimAll.filter(d => d.records.length > 0) : dkimAll
  return { dmarc, dkim: { probing, selector, results: dkim } }
}

const ALIGNMENT_LABELS = { r: 'r (relaxed)', s: 's (strict)' }

function buildDmarcRows(dmarc) {
  return dmarc.records.map(rec => {
    const tags = parseTagList(rec.data)
    const row = {
      Type: 'DMARC',
      'Domain Name': dmarc.name,
      TTL: rec.ttl,
      Policy: tags.p,
      'Subdomain Policy': tags.sp,
      Percentage: tags.pct,
      'Aggregate Reports (RUA)': tags.rua,
      'Forensic Reports (RUF)': tags.ruf,
      'DKIM Alignment': tags.adkim && (ALIGNMENT_LABELS[tags.adkim.toLowerCase()] ?? tags.adkim),
      'SPF Alignment': tags.aspf && (ALIGNMENT_LABELS[tags.aspf.toLowerCase()] ?? tags.aspf),
      'Failure Options': tags.fo,
      Record: rec.data,
    }
    return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined && v !== ''))
  })
}

function buildDkimRows(dkimResults) {
  return dkimResults.flatMap(res =>
    res.records.map(rec => {
      const tags = parseTagList(rec.data)
      const row = {
        Type: 'DKIM',
        'Domain Name': res.name,
        TTL: rec.ttl,
        Selector: res.selector,
        Version: tags.v,
        'Key Type': tags.k ?? 'rsa',
        'Public Key': tags.p === '' ? '(revoked — empty key)' : tags.p,
        Flags: tags.t,
        'Hash Algorithms': tags.h,
        'CNAME Target': rec.cname ?? undefined,
      }
      return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined && v !== ''))
    })
  )
}

function unionColumns(rows) {
  const cols = []
  for (const row of rows) for (const key of Object.keys(row)) if (!cols.includes(key)) cols.push(key)
  return cols
}

function RecordTable({ rows, keyPrefix, copiedKey, onCopy, copyValues }) {
  const columns = unionColumns(rows)
  return (
    <div className="overflow-x-auto rounded-lg border border-borderColor">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-backgroundColor">
            {columns.map(col => (
              <th
                key={col}
                className="text-left font-semibold text-text uppercase tracking-wide px-3 py-2 border-b border-borderColor whitespace-nowrap"
              >
                {col}
              </th>
            ))}
            <th className="px-3 py-2 border-b border-borderColor w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const rowKey = `${keyPrefix}-${i}`
            const copyValue = copyValues?.[i] ?? columns.map(col => String(row[col] ?? '').replace(/\n/g, ', ')).join(' ')
            return (
              <tr key={i} className="hover:bg-backgroundColor transition-colors">
                {columns.map(col => (
                  <td
                    key={col}
                    className="px-3 py-2 border-b border-borderColor last:border-b-0 text-textHeader font-mono align-top break-all whitespace-pre-line"
                  >
                    {row[col] ?? '—'}
                  </td>
                ))}
                <td className="px-3 py-2 border-b border-borderColor align-top">
                  <button
                    onClick={() => onCopy(copyValue, rowKey)}
                    className="text-text hover:text-accent transition-colors bg-transparent border-none cursor-pointer p-0.5"
                    title="Copy row"
                  >
                    {copiedKey === rowKey ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EmptyNote({ children }) {
  return (
    <p className="text-xs text-text m-0 px-3 py-1.5 rounded-lg bg-backgroundColor border border-borderColor">
      {children}
    </p>
  )
}

function ErrorNote({ children }) {
  return (
    <p className="text-xs text-red-400 m-0 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-400/30">
      {children}
    </p>
  )
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div className="bg-backgroundCard border border-borderColor rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-borderColor">
        <Icon size={16} className="text-accent shrink-0" />
        <h2 className="text-sm font-semibold text-textHeader m-0">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

export default function DnsLookup() {
  const [inputValue, setInputValue] = useState('')
  const [domain, setDomain] = useState('')
  const [selectorInput, setSelectorInput] = useState('')
  const [liveDns, setLiveDns] = useState(null)
  const [emailAuth, setEmailAuth] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const abortRef = useRef(null)

  // Restore the last query's results on mount, so switching over to another
  // tool (e.g. WHOIS Lookup) and back doesn't force a re-query. This mirrors
  // whatever the last *terminal* state was — success or an error — never a
  // stale success left over from an earlier query.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = await loadToolCache(TOOL_CACHE_KEYS.DNS_LOOKUP)
      if (cancelled || !cached) return
      if (cached.inputValue) setInputValue(cached.inputValue)
      if (cached.domain) setDomain(cached.domain)
      if (cached.selector) setSelectorInput(cached.selector)
      setEmailAuth(cached.emailAuth ?? null)
      setLiveDns(cached.liveDns ?? null)
      setError(cached.error ?? null)
    })()
    return () => { cancelled = true }
  }, [])

  const runLookup = useCallback(async () => {
    const target = normaliseHostname(inputValue)

    // Clear any previous result up front, before validation — otherwise a
    // failed re-query (empty input, malformed input, or a real DoH failure)
    // leaves the last successful lookup rendered underneath the "Lookup
    // failed" banner instead of replacing it.
    setLiveDns(null)
    setEmailAuth(null)

    if (!target) {
      setError('Please enter a domain name.')
      return
    }
    if (!isValidHostname(target)) {
      setError(`"${target}" doesn't look like a valid domain name.`)
      return
    }

    const selector = normaliseSelector(selectorInput)
    if (selector && !isValidSelector(selector)) {
      setError(`"${selector}" doesn't look like a valid DKIM selector.`)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setDomain(target)

    try {
      const [result, auth] = await Promise.all([
        fetchLiveDnsRecords(target, controller.signal),
        fetchEmailAuthRecords(target, selector, controller.signal),
      ])
      setLiveDns(result)
      setEmailAuth(auth)
      await saveToolCache(TOOL_CACHE_KEYS.DNS_LOOKUP, {
        inputValue: target, domain: target, selector, liveDns: result, emailAuth: auth, error: null,
      })
    } catch (err) {
      if (err.name === 'AbortError') return
      const message = err.message ?? 'DNS lookup failed.'
      setError(message)
      // A failed query is still a terminal state — overwrite the cache so a
      // tool switch and back shows this failure, not the previous success.
      await saveToolCache(TOOL_CACHE_KEYS.DNS_LOOKUP, { inputValue: target, domain: target, selector, liveDns: null, emailAuth: null, error: message })
    } finally {
      setLoading(false)
    }
  }, [inputValue, selectorInput])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') runLookup()
  }

  const copy = useCallback((text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }, [])

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - DNS Lookup</title>
      </Helmet>
      <PageHeader
        title="DNS Lookup"
        description="Query A, AAAA, CNAME, MX, NS, TXT, SOA, PTR, SRV, CAA, DS, and DNSKEY records — plus DMARC, DKIM, and MX host IPs — for any domain."
      />

      {/* Search bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent pointer-events-none" />
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="example.com"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-backgroundCard border border-borderColor text-sm text-textHeader placeholder-text focus:outline-none focus:border-accent transition-colors font-mono"
          />
        </div>
        <div className="relative sm:w-64">
          <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent pointer-events-none" />
          <input
            type="text"
            value={selectorInput}
            onChange={e => setSelectorInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="DKIM selector (optional)"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-backgroundCard border border-borderColor text-sm text-textHeader placeholder-text focus:outline-none focus:border-accent transition-colors font-mono"
          />
        </div>
        <button
          onClick={() => runLookup()}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          <span className="hidden sm:inline">Lookup</span>
          <span className="sm:hidden">Lookup</span>
        </button>
      </div>
      <p className="text-[11px] text-text m-0 mb-6">
        Leave the DKIM selector empty to check common selectors (google, selector1, default, …).
      </p>

      {/* Error banner */}
      {error && (
        <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-400/30 flex items-start gap-2.5">
          <CircleX size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400 font-medium m-0">Lookup failed</p>
            <p className="text-xs text-red-400/80 m-0 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loader */}
      {!liveDns && loading && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <SyncLoader color="#3B5BDB" size={13} />
          <p className="text-sm text-textHeader font-medium m-0 pt-2">Fetching Data...</p>
        </div>
      )}

      {/* Results */}
      {liveDns && !loading && !error && (
        <div className="flex flex-col gap-5">
          <SectionCard icon={Network} title="DNS Records">
            <div className="flex flex-col gap-4">
              {LIVE_RECORD_TYPES.map(type => {
                const answers = liveDns[type] ?? []
                const rows = answers.map(a => parseRecordRow(type, a, domain, liveDns.MX_IPS))

                return (
                  <div key={type}>
                    <div className="text-[10px] font-semibold tracking-wider text-text uppercase mb-1.5">
                      {type} Records
                    </div>
                    {rows.length > 0 ? (
                      <RecordTable rows={rows} keyPrefix={type} copiedKey={copiedKey} onCopy={copy} />
                    ) : (
                      <EmptyNote>No {type} records found.</EmptyNote>
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {emailAuth && (
            <>
              <SectionCard icon={ShieldCheck} title="DMARC Record">
                {emailAuth.dmarc.error ? (
                  <ErrorNote>DMARC lookup failed: {emailAuth.dmarc.error}</ErrorNote>
                ) : emailAuth.dmarc.records.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {emailAuth.dmarc.records.length > 1 && (
                      <ErrorNote>
                        Multiple DMARC records found at {emailAuth.dmarc.name}. Receivers may ignore all of them — a domain should publish only one.
                      </ErrorNote>
                    )}
                    <RecordTable
                      rows={buildDmarcRows(emailAuth.dmarc)}
                      keyPrefix="DMARC"
                      copiedKey={copiedKey}
                      onCopy={copy}
                      copyValues={emailAuth.dmarc.records.map(r => r.data)}
                    />
                  </div>
                ) : (
                  <EmptyNote>No DMARC record found at {emailAuth.dmarc.name}.</EmptyNote>
                )}
              </SectionCard>

              <SectionCard icon={KeyRound} title="DKIM Records">
                {(() => {
                  const { probing, selector, results } = emailAuth.dkim
                  const rows = buildDkimRows(results)
                  const copyValues = results.flatMap(r => r.records.map(rec => rec.data))
                  const failed = results.filter(r => r.error)

                  return (
                    <div className="flex flex-col gap-2">
                      {failed.map(r => (
                        <ErrorNote key={r.selector}>
                          DKIM lookup failed for {r.name}: {r.error}
                        </ErrorNote>
                      ))}
                      {rows.length > 0 ? (
                        <RecordTable
                          rows={rows}
                          keyPrefix="DKIM"
                          copiedKey={copiedKey}
                          onCopy={copy}
                          copyValues={copyValues}
                        />
                      ) : probing ? (
                        <EmptyNote>
                          No DKIM records found for common selectors. DKIM selectors can't be listed through DNS — enter your selector above (find it in an email's DKIM-Signature header, s= tag).
                        </EmptyNote>
                      ) : (
                        failed.length === 0 && (
                          <EmptyNote>No DKIM record found for selector "{selector}".</EmptyNote>
                        )
                      )}
                      {probing && rows.length > 0 && (
                        <p className="text-[11px] text-text m-0">
                          Showing only the common selectors that exist. Other selectors may also be published — enter one above to check it directly.
                        </p>
                      )}
                    </div>
                  )
                })()}
              </SectionCard>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!liveDns && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Globe size={32} className="text-accent mx-auto mb-2.5 sm:mb-3 sm:size-10" />
          <p className="text-sm text-textHeader font-medium m-0 mb-1">Enter a domain to get started</p>
          <p className="text-xs text-text m-0 max-w-xs">
            Try <code className="font-mono text-accent">cloudflare.com</code> or any domain you want to inspect.
          </p>
        </div>
      )}
    </div>
  )
}