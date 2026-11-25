import { useState, useCallback, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { Select } from 'antd'
import {
  Search,
  Copy,
  Check,
  History,
  Loader2,
  CircleX,
  Key,
  Radio,
  Layers,
} from 'lucide-react'
import { SyncLoader } from 'react-spinners'
import PageHeader from '../components/ui/PageHeader'
import { getApiFreaksRequest, getRequest } from '../api/apiClient'
import { TOOL_CACHE_KEYS, saveToolCache, loadToolCache } from '../utils/toolResultCache'

const APIFREAKS_API_KEY = import.meta.env.VITE_APIFREAKS_API_KEY || ''
const APIFREAKS_DNS_HISTORY_URL = 'https://api.apifreaks.com/v1.0/domain/dns/history'

const RECORD_TYPES = ['A', 'AAAA', 'MX', 'NS', 'SOA', 'SPF', 'TXT', 'CNAME']

const SELECT_OPTIONS = RECORD_TYPES.map(type => ({
  value: type,
  label: type,
}))

function isValidHostname(h) {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(h)
}

function normaliseHostname(raw) {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

function extractRecordValue(rec) {
  const raw = rec.rawText || ''
  const type = (rec.dnsType || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = type ? raw.match(new RegExp(`IN\\s+${type}\\s+([\\s\\S]*)$`, 'i')) : null
  const value = (match ? match[1] : raw).trim().replace(/\.$/, '')
  return value || raw
}


const DOH_URL = 'https://cloudflare-dns.com/dns-query'
const DOH_TYPE_CODES = { A: 1, AAAA: 28, MX: 15, NS: 2, SOA: 6, TXT: 16, CNAME: 5, SPF: 16 }

// Live (current) records for the selected type, via Cloudflare DNS-over-HTTPS.
async function fetchCurrentRecords(domain, type, signal) {
  const queryType = type === 'SPF' ? 'TXT' : type
  const { data, success } = await getRequest(
    DOH_URL,
    { name: domain, type: queryType },
    { Accept: 'application/dns-json' },
    { signal }
  )
  if (!success) throw new Error('Could not fetch current DNS records.')
  const code = DOH_TYPE_CODES[type]
  return (data.Answer ?? [])
    .filter(a => a.type === code)
    .map(a => {
      let value = a.data ?? ''
      if (type === 'TXT' || type === 'SPF') value = value.replace(/^"|"$/g, '').replace(/"\s+"/g, '')
      else value = value.replace(/\.$/, '')
      return { value, ttl: a.TTL }
    })
    .filter(r => type !== 'SPF' || /^v=spf1/i.test(r.value))
}

function parseDate(str) {
  const d = new Date(String(str).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDate(str) {
  const d = parseDate(str)
  if (!d) return str
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function timeAgo(str) {
  const d = parseDate(str)
  if (!d) return ''
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days < 1) return 'today'
  if (days < 31) return `${days} day${days > 1 ? 's' : ''} ago`
  if (days < 365) { const m = Math.floor(days / 30); return `${m} month${m > 1 ? 's' : ''} ago` }
  const y = Math.floor(days / 365)
  const m = Math.floor((days % 365) / 30)
  return `${y} yr${y > 1 ? 's' : ''}${m ? ` ${m} mo` : ''} ago`
}

function formatTtl(ttl) {
  const n = Number(ttl)
  if (!Number.isFinite(n)) return { main: String(ttl ?? '—'), sub: '' }
  let sub = `${n} sec`
  if (n >= 86400 && n % 86400 === 0) sub = `${n / 86400} day${n / 86400 > 1 ? 's' : ''}`
  else if (n >= 3600 && n % 3600 === 0) sub = `${n / 3600} hr${n / 3600 > 1 ? 's' : ''}`
  else if (n >= 60 && n % 60 === 0) sub = `${n / 60} min`
  return { main: String(n), sub }
}

async function fetchDnsHistoryPage(domain, type, page, signal) {
  const { data, success, status, message } = await getApiFreaksRequest(
    APIFREAKS_DNS_HISTORY_URL,
    { 'host-name': domain, type, page, apiKey: APIFREAKS_API_KEY },
    { signal }
  )

  if (!success) {
    if (status === 404) {
      const notFound = new Error(message || 'No historical DNS records found for this domain.')
      notFound.notFound = true
      throw notFound
    }
    throw new Error(message || 'DNS history request failed.')
  }

  return data
}

export default function DnsHistoryChecker() {
  const [inputValue, setInputValue] = useState('')
  const [domain, setDomain] = useState('')
  const [recordType, setRecordType] = useState('A')
  const [snapshots, setSnapshots] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentRecords, setCurrentRecords] = useState(null)
  const [currentType, setCurrentType] = useState('A')
  const [error, setError] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = await loadToolCache(TOOL_CACHE_KEYS.DNS_HISTORY_CHECKER)
      if (cancelled || !cached) return
      if (cached.inputValue) setInputValue(cached.inputValue)
      if (cached.domain) setDomain(cached.domain)
      if (cached.recordType) setRecordType(cached.recordType)
      setSnapshots(cached.snapshots ?? null)
      setCurrentRecords(cached.currentRecords ?? null)
      setCurrentType(cached.recordType ?? 'A')
      setPage(cached.page ?? 1)
      setTotalPages(cached.totalPages ?? 1)
      setTotalRecords(cached.totalRecords ?? 0)
      setError(cached.error ?? null)
    })()
    return () => { cancelled = true }
  }, [])

  const runCheck = useCallback(async () => {
    const target = normaliseHostname(inputValue)

    setSnapshots(null)
    setCurrentRecords(null)
    setPage(1)
    setTotalPages(1)
    setTotalRecords(0)

    if (!target) {
      setError('Please enter a domain name.')
      return
    }
    if (!isValidHostname(target)) {
      setError(`"${target}" doesn't look like a valid domain name.`)
      return
    }
    if (!APIFREAKS_API_KEY) {
      setError('No APIFreaks API key is configured. Set VITE_APIFREAKS_API_KEY in the .env file and restart the dev server.')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setDomain(target)

    try {
      const [data, current] = await Promise.all([
        fetchDnsHistoryPage(target, recordType, 1, controller.signal),
        fetchCurrentRecords(target, recordType, controller.signal).catch(() => []),
      ])
      setCurrentRecords(current)
      setCurrentType(recordType)
      const sorted = [...(data.historicalDnsRecords ?? [])].sort((a, b) => b.queryTime.localeCompare(a.queryTime))
      setSnapshots(sorted)
      setPage(data.currentPage ?? 1)
      setTotalPages(data.totalPages ?? 1)
      setTotalRecords(data.totalRecords ?? sorted.length)
      await saveToolCache(TOOL_CACHE_KEYS.DNS_HISTORY_CHECKER, {
        inputValue: target, domain: target, recordType,
        snapshots: sorted, currentRecords: current, page: data.currentPage ?? 1, totalPages: data.totalPages ?? 1, totalRecords: data.totalRecords ?? sorted.length,
        error: null,
      })
    } catch (err) {
      if (err.name === 'AbortError') return
      const message = err.notFound ? err.message : (err.message ?? 'DNS history lookup failed.')
      setError(message)
      await saveToolCache(TOOL_CACHE_KEYS.DNS_HISTORY_CHECKER, {
        inputValue: target, domain: target, recordType,
        snapshots: null, page: 1, totalPages: 1, totalRecords: 0, error: message,
      })
    } finally {
      setLoading(false)
    }
  }, [inputValue, recordType])

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return
    const controller = new AbortController()
    setLoadingMore(true)
    try {
      const data = await fetchDnsHistoryPage(domain, recordType, page + 1, controller.signal)
      const next = [...(data.historicalDnsRecords ?? [])].sort((a, b) => b.queryTime.localeCompare(a.queryTime))
      setSnapshots(prev => {
        const merged = [...(prev ?? []), ...next]
        saveToolCache(TOOL_CACHE_KEYS.DNS_HISTORY_CHECKER, {
          inputValue, domain, recordType,
          snapshots: merged, currentRecords, page: data.currentPage ?? page + 1, totalPages: data.totalPages ?? totalPages, totalRecords,
          error: null,
        })
        return merged
      })
      setPage(data.currentPage ?? page + 1)
      setTotalPages(data.totalPages ?? totalPages)
    } catch {
      // Leave existing results in place on error
    } finally {
      setLoadingMore(false)
    }
  }, [domain, recordType, page, totalPages, totalRecords, inputValue, loadingMore, currentRecords])

  const handleKeyDown = (e) => { if (e.key === 'Enter') runCheck() }

  const copy = useCallback((text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }, [])

  const allRows = snapshots?.flatMap(snap =>
    (snap.dnsRecords ?? []).map(rec => ({ ...rec, queryTime: snap.queryTime, value: extractRecordValue(rec) }))
  ) ?? []
  const currentValues = new Set((currentRecords ?? []).map(r => r.value.toLowerCase()))

  return (
    <div className="mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-8 font-poppins">
      <Helmet>
        <title>Rivo - DNS History Checker</title>
      </Helmet>
      <PageHeader
        title="DNS History Checker"
        description="See how a domain's DNS records have changed over time — A, AAAA, MX, NS, SOA, SPF, TXT, and CNAME snapshots, dated."
        badge="beta"
      />

      {!APIFREAKS_API_KEY && (
        <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-warningBg border border-warningBorder">
          <Key size={15} className="text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-text m-0 leading-relaxed">
            <span className="text-warning font-semibold">No API key configured.</span>{' '}
            Set <code className="font-mono text-textHeader">VITE_APIFREAKS_API_KEY</code> in the project's{' '}
            <code className="font-mono text-textHeader">.env</code> file (get a free key — 10,000 credits, no
            card required — from{' '}
            <a
              href="https://apifreaks.com/signup"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline"
            >
              apifreaks.com
            </a>
            ), then restart the dev server.
          </p>
        </div>
      )}

      {/* 3 Rows on small screens (flex-col), 1 Row on sm+ screens (sm:flex-row)
      */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-2 mb-6">
        {/* Search Input */}
        <div className="relative w-full sm:flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent pointer-events-none z-10" />
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
        
        {/* DNS Record Dropdown Filter */}
        <Select
          value={recordType}
          onChange={val => setRecordType(val)}
          options={SELECT_OPTIONS}
          className="w-full sm:w-32 h-[42px] font-mono shrink-0"
          showSearch
        />

        {/* Check Button */}
        <button
          onClick={() => runCheck()}
          disabled={loading || !APIFREAKS_API_KEY}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-accent text-white border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          <span>Check</span>
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
      {!snapshots && loading && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <SyncLoader color="#3B5BDB" size={13} />
          <p className="text-sm text-textHeader font-medium m-0 pt-2">Pulling DNS history…</p>
        </div>
      )}

      {/* Results */}
      {snapshots && !loading && !error && (
        <div className="flex flex-col gap-5">
          {/* Current DNS record */}
          <div className="bg-backgroundCard border border-borderColor rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-borderColor bg-backgroundColor">
              <div className="flex items-center gap-2">
                <Radio size={14} className="text-green-400" />
                <h2 className="text-sm font-semibold text-textHeader m-0">Current {currentType} records</h2>
              </div>
              <span className="text-[10px] uppercase tracking-wide font-semibold text-green-400 bg-green-500/10 border border-green-400/30 rounded-full px-2 py-0.5">Live</span>
            </div>
            {currentRecords && currentRecords.length > 0 ? (
              <ul className="list-none m-0 p-0">
                {currentRecords.map((rec, i) => {
                  const key = `current-${i}`
                  return (
                    <li key={key} className="flex items-start gap-3 px-4 py-2.5 border-b last:border-b-0 border-borderColor">
                      <span className="font-mono text-xs text-textHeader break-all flex-1">{rec.value}</span>
                      <span className="font-mono text-[11px] text-text whitespace-nowrap">TTL {rec.ttl}</span>
                      <button
                        onClick={() => copy(rec.value, key)}
                        className="text-text hover:text-accent transition-colors bg-transparent border-none cursor-pointer p-0.5"
                        title="Copy value"
                      >
                        {copiedKey === key ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-xs text-text m-0 px-4 py-4">
                No current {currentType} records found for <span className="font-mono text-textHeader">{domain}</span>.
              </p>
            )}
          </div>

          {/* Historical records */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <History size={14} className="text-accent" />
                <h2 className="text-sm font-semibold text-textHeader m-0">Historical {currentType} records</h2>
              </div>
              <p className="text-xs text-text m-0 flex items-center gap-1.5">
                <Layers size={12} />
                {totalRecords} snapshot{totalRecords === 1 ? '' : 's'} · newest first
              </p>
            </div>

            <div className="bg-backgroundCard border border-borderColor rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[640px]">
                  <thead>
                    <tr className="bg-backgroundColor">
                      <th className="text-left font-semibold text-text uppercase tracking-wide px-4 py-3 border-b border-borderColor whitespace-nowrap w-40">Date recorded</th>
                      <th className="text-left font-semibold text-text uppercase tracking-wide px-4 py-3 border-b border-borderColor whitespace-nowrap w-20">Type</th>
                      <th className="text-left font-semibold text-text uppercase tracking-wide px-4 py-3 border-b border-borderColor whitespace-nowrap">Value</th>
                      <th className="text-left font-semibold text-text uppercase tracking-wide px-4 py-3 border-b border-borderColor whitespace-nowrap w-28">TTL</th>
                      <th className="px-3 py-3 border-b border-borderColor w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map((rec, i) => {
                      const rowKey = `${rec.queryTime}-${rec.dnsType}-${i}`
                      const ttl = formatTtl(rec.ttl)
                      const isCurrent = currentValues.has(rec.value.toLowerCase())
                      return (
                        <tr key={rowKey} className="hover:bg-backgroundColor/50 transition-colors">
                          <td className="px-4 py-2.5 border-b border-borderColor align-top whitespace-nowrap">
                            <div className="text-textHeader font-medium">{formatDate(rec.queryTime)}</div>
                            <div className="text-[11px] text-text">{timeAgo(rec.queryTime)}</div>
                          </td>
                          <td className="px-4 py-2.5 border-b border-borderColor align-top">
                            <span className="inline-block font-mono text-[11px] font-semibold text-accent bg-accent/10 rounded-md px-1.5 py-0.5">{rec.dnsType}</span>
                          </td>
                          <td className="px-4 py-2.5 border-b border-borderColor align-top min-w-[220px]">
                            <div className="flex flex-wrap items-start gap-2">
                              <span className="text-textHeader font-mono break-all">{rec.value}</span>
                              {isCurrent && <span className="shrink-0 text-[10px] uppercase font-semibold text-green-400 bg-green-500/10 border border-green-400/30 rounded-full px-1.5 py-px">Live now</span>}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 border-b border-borderColor align-top whitespace-nowrap">
                            <div className="text-textHeader font-mono">{ttl.main}</div>
                            {ttl.sub && <div className="text-[11px] text-text">{ttl.sub}</div>}
                          </td>
                          <td className="px-3 py-2.5 border-b border-borderColor align-top">
                            <button
                              onClick={() => copy(rec.value, rowKey)}
                              className="text-text hover:text-accent transition-colors bg-transparent border-none cursor-pointer p-0.5"
                              title="Copy value"
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
            </div>
          </div>

          {page < totalPages && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="self-center flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-backgroundCard border border-borderColor text-textHeader cursor-pointer hover:border-accent transition-colors disabled:opacity-50"
            >
              {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
              Load more ({page} of {totalPages})
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!snapshots && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <History size={32} className="text-accent mx-auto mb-2.5 sm:mb-3 sm:size-10" />
          <p className="text-sm text-textHeader font-medium m-0 mb-1">Enter a domain to see its DNS history</p>
          <p className="text-xs text-text m-0 max-w-xs">
            Try <code className="font-mono text-accent">cloudflare.com</code> or any domain you want to trace.
          </p>
        </div>
      )}
    </div>
  )
}