import { useState, useCallback, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  Search,
  Copy,
  Loader2,
  CircleX,
  Info,
  ExternalLink,
  CalendarClock,
  CheckCircle2,
  Clock,
  RotateCcw,
  Trash2,
  HelpCircle,
} from 'lucide-react'
import { SyncLoader } from 'react-spinners'
import PageHeader from '../components/ui/PageHeader'
import { getWhoisRequest } from '../api/apiClient'
import { TOOL_CACHE_KEYS, saveToolCache, loadToolCache } from '../utils/toolResultCache'

// who-dat.as93.net — free, keyless WHOIS/RDAP lookup API. It queries RDAP
// first and falls back to WHOIS server-side, so it covers far more TLDs than
// calling rdap.org directly.
const WHOIS_API_BASE = 'https://who-dat.as93.net/'
const MS_PER_DAY = 86400000

// Post-expiration lifecycle windows, in days, per TLD. `null` means that
// stage doesn't apply / isn't publicly documented for that TLD.
// `default` = "Typical gTLD Domains" row — used for anything in KNOWN_GTLDS
// below that doesn't have its own entry.
//
// Some registries have intermediate stages this tool doesn't model
// (e.g. .uk's 60-day "Suspended" stage between Renewal Grace and Pending
// Delete, .nz's 60-day "Pending Release" stage after expiry). Those days
// aren't added into the sequence below, so results for domains actually
// sitting in one of those unmodeled stages will read a bit early/optimistic
// — flagged here rather than silently guessed at.
const TLD_LIFECYCLE = {
  default: { renewalGraceDays: 30, redemptionDays: 30, pendingDeleteDays: 5 },
  au: { renewalGraceDays: 30, redemptionDays: null, pendingDeleteDays: 3 },
  hk: { renewalGraceDays: 29, redemptionDays: 60, pendingDeleteDays: null },
  id: { renewalGraceDays: null, redemptionDays: null, pendingDeleteDays: 0 }, // immediate
  in: { renewalGraceDays: 30, redemptionDays: 30, pendingDeleteDays: 5 },
  io: { renewalGraceDays: null, redemptionDays: null, pendingDeleteDays: 0 }, // immediate
  my: { renewalGraceDays: 44, redemptionDays: null, pendingDeleteDays: null },
  nz: { renewalGraceDays: 30, redemptionDays: null, pendingDeleteDays: null },
  sg: { renewalGraceDays: 29, redemptionDays: 30, pendingDeleteDays: null },
  uk: { renewalGraceDays: 30, redemptionDays: null, pendingDeleteDays: 5 },
}

// Curated, non-exhaustive list of classic/common gTLDs that should use the
// "Typical gTLD Domains" default lifecycle. Anything not in here AND not in
// TLD_LIFECYCLE above falls into "Lifecycle Unknown" rather than guessing.
const KNOWN_GTLDS = new Set([
  'com', 'net', 'org', 'info', 'biz', 'name', 'pro', 'mobi', 'xyz', 'top',
  'online', 'site', 'store', 'tech', 'app', 'dev', 'cloud', 'shop', 'world',
  'live', 'fun', 'club', 'vip', 'wiki', 'blog', 'design', 'studio', 'agency',
  'company', 'email', 'digital', 'systems', 'solutions', 'services',
  'network', 'software', 'website', 'space', 'link', 'click',
])

function getTld(domain) {
  const parts = domain.split('.')
  return parts[parts.length - 1]
}

function isValidHostname(h) {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(h)
}

function normaliseHostname(raw) {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

// Format date as "September 15, 2026"
function formatLongDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

// Format time remaining as "X years, X months and X days" or "X days" etc.
function formatTimeRemaining(days) {
  if (days === 0) return 'Today'
  if (days < 0) return `${Math.abs(days)} days ago`
  
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  const remainingDays = days % 30
  
  const parts = []
  if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`)
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`)
  if (remainingDays > 0) parts.push(`${remainingDays} day${remainingDays > 1 ? 's' : ''}`)
  
  if (parts.length === 0) return 'Less than a day'
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return parts.join(' and ')
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]
}

function daysBetween(from, to) {
  const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const utcTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((utcTo - utcFrom) / MS_PER_DAY)
}

async function fetchExpiration(domain, signal) {
  const { data, success, status, message, error } = await getWhoisRequest(`${WHOIS_API_BASE}${domain}`, {}, { signal })

  if (!success) {
    // Handle 501 - No RDAP or WHOIS source available
    if (status === 501) {
      const noSource = new Error(message || 'No RDAP or WHOIS source is available for this TLD.')
      noSource.unsupportedTld = true
      throw noSource
    }
    // Handle 502 - Upstream registry error (WHOIS unreachable)
    if (status === 502) {
      throw new Error(message)
    }
    if (status === 400) throw new Error(message || `"${domain}" doesn't look like a valid domain name.`)
    if (status) throw new Error(message || `WHOIS lookup server returned HTTP ${status}`)
    throw error || new Error('WHOIS request failed')
  }

  // The API returns data in the structure: { query, domain, registrar, status, nameservers, dates, contacts, meta }
  // Extract the expiration date from dates.expires
  const expiryIso = data?.dates?.expires ?? null

  return {
    domain: data?.domain || domain,
    expiryIso: expiryIso,
    rawData: data, // Store the full response for additional details
  }
}

// Works out where a domain sits in its post-expiration lifecycle for a
// given TLD's rules. Returns { status, daysLabel, daysValue, immediate, remarks }.
function computeLifecycle(tld, expiryIso) {
  const expiryDate = new Date(expiryIso)
  const today = new Date()
  const daysUntilExpiry = daysBetween(today, expiryDate)

  if (daysUntilExpiry >= 0) {
    return {
      status: 'Active',
      daysLabel: 'EXPIRING IN',
      daysValue: daysUntilExpiry,
      remarks: 'Customer can renew the domain before the expiry date.',
    }
  }

  const daysSinceExpiry = -daysUntilExpiry
  const config = TLD_LIFECYCLE[tld] ?? (KNOWN_GTLDS.has(tld) ? TLD_LIFECYCLE.default : null)

  const unknown = {
    status: 'Lifecycle Unknown',
    daysLabel: null,
    daysValue: null,
    remarks: 'Expiration information is available, but the post-expiration lifecycle for this TLD could not be determined. Contact the registrar to confirm renewal eligibility.',
  }

  if (!config) return unknown

  const { renewalGraceDays, redemptionDays, pendingDeleteDays } = config
  let cursor = 0

  if (renewalGraceDays != null) {
    const windowEnd = cursor + renewalGraceDays
    if (daysSinceExpiry <= windowEnd) {
      return {
        status: 'Renewal Grace Period',
        daysLabel: 'PERIOD REMAINING',
        daysValue: Math.max(0, windowEnd - daysSinceExpiry),
        remarks: 'Customer can still renew the domain during this period. Standard renewal may be available.',
      }
    }
    cursor = windowEnd
  }

  if (redemptionDays != null) {
    const windowEnd = cursor + redemptionDays
    if (daysSinceExpiry <= windowEnd) {
      return {
        status: 'Redemption Period',
        daysLabel: 'PERIOD REMAINING',
        daysValue: Math.max(0, windowEnd - daysSinceExpiry),
        remarks: 'The domain may still be restored during this period. Additional restoration fees may apply.',
      }
    }
    cursor = windowEnd
  }

  if (pendingDeleteDays != null) {
    if (pendingDeleteDays === 0) {
      return {
        status: 'Pending Delete',
        daysLabel: 'DELETION IN',
        immediate: true,
        remarks: 'The domain is scheduled for deletion and cannot normally be renewed or restored. After deletion, it may become available for public registration.',
      }
    }
    const windowEnd = cursor + pendingDeleteDays
    return {
      status: 'Pending Delete',
      daysLabel: 'DELETION IN',
      daysValue: Math.max(0, windowEnd - daysSinceExpiry),
      remarks: 'The domain is scheduled for deletion and cannot normally be renewed or restored. After deletion, it may become available for public registration.',
    }
  }

  // No further known stage defined for this TLD past whatever windows it does have.
  return unknown
}

const STATUS_STYLES = {
  'Active': { 
    color: 'text-green-400', 
    bg: 'bg-green-500/10', 
    border: 'border-green-500/20', 
    Icon: CheckCircle2 
  },
  'Renewal Grace Period': { 
    color: 'text-yellow-400', 
    bg: 'bg-yellow-500/10', 
    border: 'border-yellow-500/20', 
    Icon: RotateCcw 
  },
  'Redemption Period': {
     color: 'text-orange-400', 
     bg: 'bg-orange-500/10', 
     border: 'border-orange-500/20', 
     Icon: Clock 
    },
  'Pending Delete': { 
    color: 'text-red-400', 
    bg: 'bg-red-500/10', 
    border: 'border-red-500/20', 
    Icon: Trash2 
  },
  'Lifecycle Unknown': { 
    color: 'text-text', 
    bg: 'bg-backgroundCard', 
    border: 'border-borderColor', 
    Icon: HelpCircle 
  },
}

// Builds the exact plain-text block shown in the lifecycle templates:
// Domain / Expiry Date / Status / <days line> / Remarks.
function buildLifecycleText({ domain, expiryFormatted, status, daysLabel, daysValue, immediate, remarks }) {
  const lines = []
  const kv = (label, value, width = 14) => lines.push(`${(label + ':').padEnd(width)} ${value}`)

  kv('Domain', domain)
  kv('Expiry Date', expiryFormatted)
  kv('Status', status)
  if (daysLabel) kv(daysLabel, immediate ? 'Immediate' : formatTimeRemaining(daysValue))
  kv('Remarks', remarks)

  return lines.join('\n')
}

// Data Table Display Component
function LifecycleDataTable({ result }) {
  const { domain, expiryFormatted, status, daysLabel, daysValue, immediate, remarks } = result
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES['Lifecycle Unknown']
  const StatusIcon = statusStyle.Icon

  // Format the days value for display
  let daysDisplay = 'N/A'
  if (daysLabel) {
    if (immediate) {
      daysDisplay = 'Immediate'
    } else if (daysValue !== null && daysValue !== undefined) {
      daysDisplay = formatTimeRemaining(daysValue)
    }
  }

  return (
    <div className="bg-backgroundCard border border-borderColor rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-borderColor">
              <td className="px-5 py-3 text-xs text-text font-medium w-1/3">DOMAIN NAME</td>
              <td className="px-5 py-3 text-textHeader">{domain}</td>
            </tr>
            <tr className="border-b border-borderColor">
              <td className="px-5 py-3 text-xs text-text font-medium">CURRENT STATUS</td>
              <td className="px-5 py-3">
                <span 
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusStyle.bg} ${statusStyle.color} ${statusStyle.border}`}
                >
                  <StatusIcon size={13} />
                  {status}
                </span>
              </td>
            </tr>
            <tr className="border-b border-borderColor">
              <td className="px-5 py-3 text-xs text-text font-medium">EXPIRY DATE</td>
              <td className="px-5 py-3 text-textHeader">{expiryFormatted}</td>
            </tr>
            {daysLabel && (
              <tr className="border-b border-borderColor">
                <td className="px-5 py-3 text-xs text-text font-medium">{daysLabel}</td>
                <td className="px-5 py-3 text-textHeader font-medium">{daysDisplay}</td>
              </tr>
            )}
            {status.toLowerCase() !== 'active' && (
              <tr>
                <td className="px-5 py-3 text-xs text-text font-medium">REMARKS</td>
                <td className="px-5 py-3 text-textHeader text-sm leading-relaxed">{remarks}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function DomainLifecycleChecker() {
  const [inputValue, setInputValue] = useState('')
  const [domain, setDomain] = useState('')
  const [result, setResult] = useState(null)         // computed lifecycle result, or null
  const [expiryMissing, setExpiryMissing] = useState(false) // lookup succeeded but had no expiration date
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [unsupportedTld, setUnsupportedTld] = useState(null)
  const abortRef = useRef(null)

  // Restore the last query on mount, so switching tools and back doesn't
  // force a re-query. Mirrors whatever the last terminal state was.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = await loadToolCache(TOOL_CACHE_KEYS.DOMAIN_LIFECYCLE_CHECKER)
      if (cancelled || !cached) return
      if (cached.inputValue) setInputValue(cached.inputValue)
      if (cached.domain) setDomain(cached.domain)
      setResult(cached.result ?? null)
      setExpiryMissing(cached.expiryMissing ?? false)
      setUnsupportedTld(cached.unsupportedTld ?? null)
      setError(cached.error ?? null)
    })()
    return () => { cancelled = true }
  }, [])

  const runCheck = useCallback(async () => {
    const target = normaliseHostname(inputValue)

    // Clear previous result up front, before validation — otherwise a failed
    // re-query leaves the last result rendered behind the error banner.
    setResult(null)
    setExpiryMissing(false)
    setUnsupportedTld(null)

    if (!target || !isValidHostname(target)) {
      setError(!target ? 'Please enter a domain name.' : `"${target}" doesn't look like a valid domain name.`)
      return
    }

    abortRef.current?.abort()
    setError(null)
    setDomain(target)

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)

    try {
      const { domain: resolvedName, expiryIso } = await fetchExpiration(target, controller.signal)

      if (!expiryIso) {
        setExpiryMissing(true)
        await saveToolCache(TOOL_CACHE_KEYS.DOMAIN_LIFECYCLE_CHECKER, {
          inputValue: target, domain: resolvedName, result: null, expiryMissing: true, unsupportedTld: null, error: null,
        })
        return
      }

      const tld = getTld(target)
      const lifecycle = computeLifecycle(tld, expiryIso)
      const computed = { ...lifecycle, domain: resolvedName, expiryFormatted: formatLongDate(expiryIso) }
      setResult(computed)
      await saveToolCache(TOOL_CACHE_KEYS.DOMAIN_LIFECYCLE_CHECKER, {
        inputValue: target, domain: resolvedName, result: computed, expiryMissing: false, unsupportedTld: null, error: null,
      })
    } catch (err) {
      if (err.name === 'AbortError') return

      if (err.unsupportedTld) {
        setUnsupportedTld({ tld: getTld(target) })
        await saveToolCache(TOOL_CACHE_KEYS.DOMAIN_LIFECYCLE_CHECKER, {
          inputValue: target, domain: target, result: null, expiryMissing: false, unsupportedTld: { tld: getTld(target) }, error: null,
        })
        return
      }

      const message = err.message ?? 'Lookup failed.'
      setError(message)
      await saveToolCache(TOOL_CACHE_KEYS.DOMAIN_LIFECYCLE_CHECKER, {
        inputValue: target, domain: target, result: null, expiryMissing: false, unsupportedTld: null, error: message,
      })
    } finally {
      setLoading(false)
    }
  }, [inputValue])

  const handleKeyDown = (e) => { if (e.key === 'Enter') runCheck() }

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Domain Lifecycle Checker</title>
      </Helmet>
      <PageHeader
        title="Domain Lifecycle Checker"
        description="Check whether a domain is active, in its renewal grace period, redemption period, or pending delete."
        badge="beta"
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
          onClick={() => runCheck()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          <span className="hidden sm:inline">Check</span>
        </button>
      </div>

      {/* Unsupported TLD banner */}
      {unsupportedTld && !loading && (
        <div className="mb-5 p-4 rounded-2xl bg-orange-500/10 border border-orange-400/30 flex items-start gap-2.5">
          <Info size={16} className="text-orange-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-orange-400 font-medium m-0">
              No WHOIS/RDAP data source is available for .{unsupportedTld.tld} domains
            </p>
            <p className="text-xs text-orange-400/80 m-0 mt-0.5">
              This registry doesn't provide RDAP or WHOIS services. Please check with the .{unsupportedTld.tld} registry directly.
            </p>
          </div>
        </div>
      )}

      {/* Expiry-date-unavailable banner */}
      {expiryMissing && !loading && (
        <div className="mb-5 p-4 rounded-2xl bg-orange-500/10 border border-orange-400/30 flex items-start gap-2.5">
          <Info size={16} className="text-orange-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-orange-400 font-medium m-0">Expiry date not available</p>
            <p className="text-xs text-orange-400/80 m-0 mt-0.5">
              This domain's WHOIS/RDAP record didn't include an expiration date — some registries redact
              it entirely. Try WHOIS Lookup to see what fields are available, or check with the
              registrar directly.
            </p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-400/30 flex items-start gap-2.5">
          <CircleX size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400 font-medium m-0">Check failed</p>
            <p className="text-xs text-red-400/80 m-0 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loader */}
      {!result && loading && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <SyncLoader color="#3B5BDB" size={13} />
          <p className="text-sm text-textHeader font-medium m-0 pt-2">Checking lifecycle…</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && !error && (
        <div className="flex flex-col gap-4">        
          {/* Data Table */}
          <LifecycleDataTable result={result} />
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && !unsupportedTld && !expiryMissing && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CalendarClock size={32} className="text-accent mx-auto mb-2.5 sm:mb-3 sm:size-10" />
          <p className="text-sm text-textHeader font-medium m-0 mb-1">Enter a domain to check its lifecycle stage</p>
          <p className="text-xs text-text m-0 max-w-xs">
            Try <code className="font-mono text-accent">cloudflare.com</code> or any domain you want to check.
          </p>
        </div>
      )}
    </div>
  )
}