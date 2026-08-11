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
  return results
}

// Cloudflare's DoH JSON returns each answer's value as a single presentation-
// format string (e.g. "10 smtp.google.com." for MX, or a space-separated
// SOA/DS/DNSKEY payload). This breaks each record type's raw `data` string
// into the same structured columns a real DNS table shows (dnschecker.org-
// style) instead of one opaque blob per row.
function parseRecordRow(type, entry, domain) {
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
      return { ...base, Preference: preference, Address: stripTrailingDot(rest.join(' ')) }
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
  const [liveDns, setLiveDns] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const abortRef = useRef(null)

  // Restore the last query's results on mount, so switching over to another
  // tool (e.g. WHOIS Lookup) and back doesn't force a re-query.
  useEffect(() => {
    const cached = loadToolCache(TOOL_CACHE_KEYS.DNS_LOOKUP)
    if (!cached) return
    if (cached.inputValue) setInputValue(cached.inputValue)
    if (cached.domain) setDomain(cached.domain)
    if (cached.liveDns) setLiveDns(cached.liveDns)
  }, [])

  const runLookup = useCallback(async () => {
    const target = normaliseHostname(inputValue)

    if (!target) {
      setError('Please enter a domain name.')
      return
    }
    if (!isValidHostname(target)) {
      setError(`"${target}" doesn't look like a valid domain name.`)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setDomain(target)
    setLiveDns(null)

    try {
      const result = await fetchLiveDnsRecords(target, controller.signal)
      setLiveDns(result)
      saveToolCache(TOOL_CACHE_KEYS.DNS_LOOKUP, { inputValue: target, domain: target, liveDns: result })
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message ?? 'DNS lookup failed.')
    } finally {
      setLoading(false)
    }
  }, [inputValue])

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
        description="Query A, AAAA, CNAME, MX, NS, TXT, SOA, PTR, SRV, CAA, DS, and DNSKEY records for any domain."
      />

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
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
        <button
          onClick={() => runLookup()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          <span className="hidden sm:inline">Lookup</span>
        </button>
      </div>

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
      {liveDns && !loading && (
        <SectionCard icon={Network} title="DNS Records">
          <div className="flex flex-col gap-4">
            {LIVE_RECORD_TYPES.map(type => {
              const answers = liveDns[type] ?? []
              const rows = answers.map(a => parseRecordRow(type, a, domain))
              const columns = rows[0] ? Object.keys(rows[0]) : []

              return (
                <div key={type}>
                  <div className="text-[10px] font-semibold tracking-wider text-text uppercase mb-1.5">
                    {type} Records
                  </div>
                  {rows.length > 0 ? (
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
                            const rowKey = `${type}-${i}`
                            const copyValue = columns.map(col => row[col]).join(' ')
                            return (
                              <tr key={i} className="hover:bg-backgroundColor transition-colors">
                                {columns.map(col => (
                                  <td
                                    key={col}
                                    className="px-3 py-2 border-b border-borderColor last:border-b-0 text-textHeader font-mono align-top break-all"
                                  >
                                    {row[col]}
                                  </td>
                                ))}
                                <td className="px-3 py-2 border-b border-borderColor align-top">
                                  <button
                                    onClick={() => copy(copyValue, rowKey)}
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
                  ) : (
                    <p className="text-xs text-text m-0 px-3 py-1.5 rounded-lg bg-backgroundColor border border-borderColor">
                      No {type} records found.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </SectionCard>
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