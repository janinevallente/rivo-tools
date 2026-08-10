import { useState, useCallback, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  Cpu,
  Search,
  Loader2,
  CircleX,
  Globe,
  Info,
  ExternalLink,
  ShieldAlert,
  Wifi,
  Code2,
  Layers,
  CheckCircle2,
  SearchX,
} from 'lucide-react'
import { SyncLoader } from 'react-spinners'
import PageHeader from '../components/ui/PageHeader'
import { getRequest } from '../api/apiClient'
import { buildPsiUrl, PAGESPEED_API_KEY, getStackPacks } from '../utils/pageSpeedUtils'
import { frameworkSignatures, maxDnsScore, scorePsi } from '../data/frameworkSignatures'

const DOH_URL = 'https://cloudflare-dns.com/dns-query'

// Helpers
function isValidHostname(h) {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(h)
}

function normaliseHostname(raw) {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

function stripTrailingDot(s = '') {
  return s.replace(/\.$/, '')
}

// DNS layer

async function queryDoh(name, type, signal) {
  const { data, success, error } = await getRequest(
    DOH_URL, { name, type }, { Accept: 'application/dns-json' }, { signal }
  )
  if (!success) {
    const status = error?.response?.status
    throw new Error(status ? `DoH HTTP ${status}` : error?.message ?? 'DoH request failed')
  }
  return data
}

async function collectDnsSignals(hostname, signal) {
  const hosts = hostname.startsWith('www.') ? [hostname] : [hostname, `www.${hostname}`]

  const queries = hosts.flatMap(h => [
    queryDoh(h, 'CNAME', signal).then(d => ({ type: 'CNAME', data: d })).catch(() => null),
    queryDoh(h, 'A',     signal).then(d => ({ type: 'A',     data: d })).catch(() => null),
  ])
  queries.push(
    queryDoh(hostname, 'NS', signal).then(d => ({ type: 'NS', data: d })).catch(() => null)
  )

  const settled = (await Promise.all(queries)).filter(Boolean)
  const cnames = new Set(), addresses = new Set(), nameservers = new Set()
  let anyAnswer = false

  for (const { type, data } of settled) {
    const answers = data?.Answer ?? []
    if (answers.length) anyAnswer = true
    for (const a of answers) {
      const v = stripTrailingDot(a.data || '')
      if (!v) continue
      if (type === 'CNAME' && a.type === 5) cnames.add(v)
      if (type === 'A'     && a.type === 1) addresses.add(v)
      if (type === 'NS'    && a.type === 2) nameservers.add(v)
    }
  }

  return { cnames: [...cnames], addresses: [...addresses], nameservers: [...nameservers], anyAnswer }
}

function scoreDns(sig, { cnames, addresses, nameservers }, hostname) {
  if (sig.nativeDomainPattern?.test(hostname)) {
    return {
      score: 100,
      max: 100,
      signals: [{ type: 'native', label: `Native Domain Match` }],
    }
  }

  const rules = sig.dns?.rules ?? []
  if (!rules.length) return { score: 0, max: 0, signals: [] }

  let score = 0
  const signals = []

  for (const rule of rules) {
    const haystack = rule.type === 'cname' ? cnames : rule.type === 'a' ? addresses : nameservers
    const hit = haystack.find(v => rule.pattern.test(v))
    if (hit) {
      score += rule.weight
      const kind = rule.type === 'cname' ? 'CNAME' : rule.type === 'a' ? 'A Record' : 'NS Record'
      signals.push({ type: rule.type, label: `${kind}: ${hit}` })
    }
  }

  return { score, max: maxDnsScore(sig), signals }
}

// PSI layer

async function runPsi(hostname, apiKey, signal) {
  const targetUrl = `https://${hostname}`
  const url = buildPsiUrl(targetUrl, 'mobile', apiKey)
  const { data, success, error } = await getRequest(url, {}, {}, { signal })
  if (!success) {
    const msg = error?.response?.data?.error?.message
    throw new Error(msg || `PSI error (HTTP ${error?.response?.status ?? '?'})`)
  }
  return data
}

function extractPsiSignals(psiData) {
  const lr = psiData?.lighthouseResult
  if (!lr) return { stackPackIds: new Set(), scriptUrls: [], html: '' }

  const stackPackIds = new Set(getStackPacks(lr).map(p => p.id?.toLowerCase()))
  const networkItems = lr.audits?.['network-requests']?.details?.items ?? []
  const scriptUrls = networkItems
    .filter(i => i.resourceType === 'Script' || /\.js(\?|$)/.test(i.url ?? ''))
    .map(i => i.url ?? '')

  const htmlHints = [
    lr.finalUrl ?? '',
    JSON.stringify(lr.audits?.['uses-rel-preconnect']?.details ?? {}),
    JSON.stringify(lr.audits?.['render-blocking-resources']?.details ?? {}),
    JSON.stringify(lr.audits?.['third-party-summary']?.details ?? {}),
    JSON.stringify(lr.audits?.['script-treemap-data']?.details ?? {}),
    JSON.stringify(networkItems),
  ].join(' ')

  return { stackPackIds, scriptUrls, html: htmlHints }
}

// Combined detection

function mergeResults(dnsSignals, psiSignals, hostname) {
  return frameworkSignatures
    .map(sig => {
      const dns = scoreDns(sig, dnsSignals, hostname)
      const psi = psiSignals ? scorePsi(sig, psiSignals) : { score: 0, max: 0, signals: [] }

      if (dns.score === 100 && dns.max === 100) {
        return { sig, confidence: 100, dnsSignals: dns.signals, psiSignals: [] }
      }

      const totalScore = dns.score + psi.score
      const totalMax   = (dns.max || 0) + (psi.max || 0)
      const confidence = totalMax > 0 ? Math.min(100, Math.round((totalScore / totalMax) * 100)) : 0

      return { sig, confidence, dnsSignals: dns.signals, psiSignals: psi.signals }
    })
    .filter(r => r.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
}

// UI helpers

const SIGNAL_CONFIG = {
  native:    { Icon: Globe,    color: 'text-purple-400' },
  cname:     { Icon: Wifi,     color: 'text-blue-400' },
  a:         { Icon: Wifi,     color: 'text-blue-400' },
  ns:        { Icon: Wifi,     color: 'text-blue-400' },
  stackpack: { Icon: Layers,   color: 'text-emerald-400' },
  script:    { Icon: Code2,    color: 'text-emerald-400' },
  html:      { Icon: Code2,    color: 'text-emerald-400' },
}

function SignalList({ dnsSignals = [], psiSignals = [] }) {
  const all = [...dnsSignals, ...psiSignals]

  if (!all.length) {
    return <span className="text-xs text-text italic">No specific signals logged</span>
  }

  return (
    <ul className="m-0 pl-0 list-none flex flex-col gap-1.5">
      {all.map((s, idx) => {
        const conf = SIGNAL_CONFIG[s.type] ?? SIGNAL_CONFIG.html
        const Icon = conf.Icon

        return (
          <li key={idx} className="flex items-start gap-2 text-xs font-mono text-textHeader break-all">
            <Icon size={13} className={`${conf.color} shrink-0 mt-0.5`} />
            <span className="leading-tight">{s.label}</span>
          </li>
        )
      })}
    </ul>
  )
}

function CategoryBadge({ label }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-semibold tracking-wide uppercase bg-accentBg text-accent border-accentBorder">
      {label}
    </span>
  )
}

// Table Row Component
function TechTableRow({ result, isBestMatch = false }) {
  const { sig, dnsSignals, psiSignals } = result

  return (
    <tr 
      className={`border-b border-borderColor transition-colors hover:bg-accentBg/10 ${
        isBestMatch ? 'bg-accentBg/20' : ''
      }`}
    >
      {/* Technology & Info */}
      <td className="py-4 px-4 align-top max-w-[240px]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-textHeader">
                {sig.name}
              </span>
              {isBestMatch && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-accent text-white">
                  <CheckCircle2 size={10} /> Primary
                </span>
              )}
            </div>
            
            {sig.description && (
              <p className="text-[11px] text-text m-0 mt-1 leading-relaxed line-clamp-2">
                {sig.description}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="py-4 px-4 hidden sm:table-cell align-top whitespace-nowrap">
        <CategoryBadge label={sig.category} />
      </td>

      {/* Matched Signals List */}
      <td className="py-4 px-4 align-top">
        <SignalList dnsSignals={dnsSignals} psiSignals={psiSignals} />
      </td>

      {/* External Link */}
      <td className="py-4 px-4 text-right align-top whitespace-nowrap">
        <a
          href={sig.homepage}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 inline-flex items-center text-text hover:text-accent transition-colors rounded-lg hover:bg-backgroundCard border border-transparent hover:border-borderColor"
          title={`Visit ${sig.name}`}
        >
          <ExternalLink size={14} />
        </a>
      </td>
    </tr>
  )
}

export default function FrameworkDetector() {
  const [inputValue, setInputValue] = useState('')
  const [queryHost, setQueryHost]  = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState('')   // 'dns' | 'psi' | ''
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const run = useCallback(async () => {
    const hostname = normaliseHostname(inputValue)
    if (!hostname || !isValidHostname(hostname)) {
      setError('Please enter a valid domain, e.g. example.com')
      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)
    setResults(null)
    setQueryHost(hostname)

    try {
      setPhase('dns')
      const dnsPromise = collectDnsSignals(hostname, ctrl.signal)
      const psiPromise = PAGESPEED_API_KEY
        ? (setPhase('psi'), runPsi(hostname, PAGESPEED_API_KEY, ctrl.signal))
        : Promise.resolve(null)

      const [dnsSignals, psiData] = await Promise.all([dnsPromise, psiPromise])

      if (!dnsSignals.anyAnswer && !psiData) {
        throw new Error("Couldn't resolve any DNS records for that domain.")
      }

      const psiSignals = psiData ? extractPsiSignals(psiData) : null
      setResults(mergeResults(dnsSignals, psiSignals, hostname))
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') return
      setError(err.message || 'Detection failed.')
    } finally {
      setLoading(false)
      setPhase('')
    }
  }, [inputValue])

  const handleKeyDown = (e) => { if (e.key === 'Enter') run() }

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Framework Detector</title>
      </Helmet>
      <PageHeader
        title="Framework Detector"
        description="Detect the hosting platform, frontend framework, CDN, or deployment stack behind any website."
        badge="beta"
      />

      {/* Search Bar */}
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
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          <span className="hidden sm:inline">Detect Stack</span>
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-400/30 flex items-start gap-2.5">
          <CircleX size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400 font-medium m-0">Detection failed</p>
            <p className="text-xs text-red-400/80 m-0 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <SyncLoader color="#3B5BDB" size={12} />
          <p className="text-sm text-textHeader font-medium m-0 pt-2">
            Detecting frameworks & technologies…
          </p>
        </div>
      )}

      {/* Results Table */}
      {results && !loading && (
        <div className="flex flex-col gap-4">
          {results.length > 0 ? (
            <div className="rounded-2xl border border-borderColor bg-backgroundCard overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-borderColor bg-accentBg/20 text-[11px] font-semibold text-text uppercase tracking-wider">
                      <th className="py-3.5 px-4">Technology</th>
                      <th className="py-3.5 px-4 hidden sm:table-cell">Category</th>
                      <th className="py-3.5 px-4">Matched Signals</th>
                      <th className="py-3.5 px-4 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, index) => (
                      <TechTableRow 
                        key={r.sig.id} 
                        result={r} 
                        isBestMatch={index === 0} 
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl bg-backgroundCard border border-borderColor">
              <SearchX size={28} className="text-accent mx-auto mb-2.5" />
              <p className="text-sm text-textHeader font-medium m-0 mb-1">No known technologies detected</p>
              <p className="text-xs text-text m-0 max-w-sm">
                This domain appears to use generic or custom infrastructure with no high-confidence fingerprints.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty Initial State */}
      {!results && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Cpu size={36} className="text-accent mx-auto mb-3" />
          <p className="text-sm text-textHeader font-medium m-0 mb-1">Enter a domain to detect its stack</p>
          <p className="text-xs text-text m-0 max-w-xs leading-relaxed">
            Detects hosting platforms, frontend frameworks, CDNs, ecommerce platforms, and website
            builders. Try{' '}
            <code className="font-mono text-accent">vercel.com</code> or{' '}
            <code className="font-mono text-accent">nextjs.org</code>.
          </p>
        </div>
      )}
    </div>
  )
}