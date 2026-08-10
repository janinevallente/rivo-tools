import { useState, useCallback, useEffect, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import axios from 'axios'
import { Modal } from 'antd'
import {
  Copy,
  Check,
  RefreshCw,
  HelpCircle,
  ShieldAlert,
  Loader2,
  MapPin,
  Eye
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import IpLookupMap from '../components/ui/IpLookupMap' 
import { getRequest } from '../api/apiClient'

// API layer constants
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/
const IPV6_RE = /^[0-9a-fA-F:]+:[0-9a-fA-F:]*$/

async function fetchJson(url, signal) {
  const res = await getRequest(url, {}, {}, { signal })
  if (!res.success) throw res.error || new Error('HTTP Request Failed')
  return res.data
}

async function lookupIp(signal) {
  // Query ipinfo's highly stable free tier
  const res = await getRequest('https://ipinfo.io/json', {}, {}, { signal })
  if (!res.success) {
    throw res.error || new Error(`HTTP Error: Request failed`)
  }
  
  const d = res.data
  
  // Parse latitude and longitude from the "lat,lon" string safely
  const [lat, lon] = d.loc ? d.loc.split(',').map(Number) : [undefined, undefined]

  // Parse d.org (e.g., "AS15169 Google LLC") into separate ASN and ISP components
  let parsedAsn = undefined
  let parsedIsp = d.org || 'Unknown ISP'

  if (d.org && d.org.includes(' ')) {
    const spaceIndex = d.org.indexOf(' ')
    parsedAsn = d.org.substring(0, spaceIndex)          // First word (e.g., "AS15169")
    parsedIsp = d.org.substring(spaceIndex + 1).trim()   // The rest of the string (e.g., "Google LLC")
  } else if (d.org && d.org.startsWith('AS')) {
    // Handling edge case if org string only contains the ASN
    parsedAsn = d.org
  }

  // Normalize response properties to feed your existing UI layers perfectly
  return {
    ip: d.ip,
    hostname: d.hostname,
    city: d.city,
    region: d.region,
    country: d.country,
    postal: d.postal,
    latitude: lat,
    longitude: lon,
    isp: parsedIsp,
    asn: parsedAsn,
    source: 'ipinfo.io',
  }
}

// Derived value helpers
function ipv4ToDecimal(ip) {
  if (!IPV4_RE.test(ip)) return null
  const parts = ip.split('.').map(Number)
  if (parts.some(p => p > 255)) return null
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

function toDms(value, posLabel, negLabel) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  const dir = value >= 0 ? posLabel : negLabel
  const abs = Math.abs(value)
  const deg = Math.floor(abs)
  const minFloat = (abs - deg) * 60
  const min = Math.floor(minFloat)
  const sec = ((minFloat - min) * 60).toFixed(2)
  return `${deg}\u00B0 ${min}' ${sec}" ${dir}`
}

// UI bits
function InfoRow({ label, value, mono = false, copyable = false, onCopy, copiedKey, fieldKey, large = false }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-borderColor last:border-b-0">
      <span className="text-xs text-text shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-textHeader truncate text-right ${mono ? 'font-mono' : 'font-medium'} ${large ? 'text-base' : 'text-sm'}`}>
          {value}
        </span>
        {copyable && (
          <button
            onClick={() => onCopy(String(value), fieldKey)}
            className="text-text hover:text-accent transition-colors bg-transparent border-none cursor-pointer p-0.5 shrink-0"
            title="Copy"
          >
            {copiedKey === fieldKey ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </div>
  )
}

function SkeletonBlock() {
  return (
    <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 animate-pulse">
      <div className="h-3 w-32 bg-borderColor rounded mb-4" />
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 bg-backgroundColor border border-borderColor rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function IpLookup() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const runLookup = useCallback(() => {
    const controller = new AbortController()

    Promise.resolve().then(() => {
      if (controller.signal.aborted) return
      setLoading(true)
      setError(null)
    })

    lookupIp(controller.signal)
      .then((data) => {
        setResult(data)
      })
      .catch((err) => {
        if (axios.isCancel(err) || err.name === 'AbortError') return
        setError(err.message || 'Could not look up your IP address.')
        setResult(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const abort = runLookup()
    return abort
  }, [runLookup])

  const copy = useCallback((text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }, [])

  const derived = useMemo(() => {
    if (!result) return null
    return {
      decimal: ipv4ToDecimal(result?.ip),
      latDms: toDms(result?.latitude, 'N', 'S'),
      lonDms: toDms(result?.longitude, 'E', 'W'),
    }
  }, [result])

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - IP Address Lookup</title>
      </Helmet>
      <PageHeader
        title="IP Address Lookup"
        description="View configuration details and geological metrics for your current public IP address."
      />

      {/* Error state */}
      {error && (
        <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-400/30 flex items-start gap-2.5">
          <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400 font-medium m-0">Lookup failed</p>
            <p className="text-xs text-red-400/80 m-0 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading && !result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            
            {/* LEFT SIDE CARDS (5 Columns) */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              
              {/* Primary IP Box */}
              <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-xs font-semibold text-textHeader m-0">
                      My IP Address is:
                    </p>
                    {loading && <Loader2 size={13} className="text-accent animate-spin" />}
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl bg-backgroundColor border border-borderColor">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-semibold text-accent uppercase shrink-0">
                        {IPV6_RE.test(result?.ip) && !IPV4_RE.test(result?.ip) ? 'IPv6' : 'IPv4'}
                      </span>
                      <span className="text-lg sm:text-xl font-bold text-textHeader font-mono truncate">
                        {result?.ip}
                      </span>
                    </div>
                    <button
                      onClick={() => copy(result?.ip, 'ip')}
                      className="text-text hover:text-accent transition-colors bg-transparent border-none cursor-pointer p-1 shrink-0"
                      title="Copy IP"
                    >
                      {copiedKey === 'ip' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={runLookup}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Quick Summary Box */}
              <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold text-textHeader m-0 mb-3">My IP Information:</p>
                  <div className="flex flex-col">
                    <InfoRow label="ISP" value={result?.isp} />
                    <InfoRow label="City" value={result?.city} />
                    <InfoRow label="Region" value={result?.region} />
                    <InfoRow label="Country" value={result?.country} />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(true)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50"
                  >
                    <Eye size={12} className={loading ? 'animate-spin' : ''} />
                    View Complete IP Details
                  </button>
                </div>
              </div>

            </div>

            {/* RIGHT SIDE LEAFLET MAP (7 Columns) */}
            <div className="lg:col-span-7 flex">
              <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 w-full flex flex-col min-h-[380px] lg:min-h-full">
                <p className="text-xs font-semibold text-textHeader m-0 mb-3 flex items-center gap-1.5">
                  <MapPin size={14} className="text-accent" /> Estimated IP Location Map
                </p>
                <div className="flex-1 w-full relative rounded-xl overflow-hidden border border-borderColor bg-backgroundColor">
                  {typeof result?.latitude === 'number' && typeof result?.longitude === 'number' ? (
                    <IpLookupMap 
                      latitude={result.latitude}
                      longitude={result.longitude}
                      label={`${result.city ?? 'Unknown City'}, ${result.country ?? ''} (${result.ip})`}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-text">
                      Geographic coordinates unavailable for mapping.
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Details Modal */}
      <Modal
        title={`IP Details For: ${result?.ip ?? ''}`}
        open={detailsOpen}
        onCancel={() => setDetailsOpen(false)}
        footer={null}
        centered
        width={460}
      >
        {result && derived && (
          <div className="flex flex-col">
            <InfoRow label="Decimal" value={derived.decimal ?? '—'} mono copyable={derived.decimal != null} onCopy={copy} copiedKey={copiedKey} fieldKey="decimal" />
            <InfoRow label="ASN" value={result?.asn} mono />
            <InfoRow label="Hostname" value={result?.hostname} mono />
            <InfoRow label="ISP" value={result?.isp} />
            <InfoRow label="Country" value={result?.country} />
            <InfoRow label="State/Region" value={result?.region} />
            <InfoRow label="City" value={result?.city} />
            <InfoRow label="Latitude" value={typeof result?.latitude === 'number' ? `${result?.latitude?.toFixed(4)} (${derived?.latDms})` : undefined} mono />
            <InfoRow label="Longitude" value={typeof result?.longitude === 'number' ? `${result?.longitude?.toFixed(4)} (${derived?.lonDms})` : undefined} mono />
          </div>
        )}
        <div className="mt-4 p-2.5 sm:p-3 bg-accentBg border border-accentBorder rounded-lg text-[11px] sm:text-xs text-text">
          <span className="text-accent font-semibold">Note:</span> Latitude and Longitude are often near the center of population. These values
          are not precise enough to identify a specific address or individual.
        </div>
      </Modal>
    </div>
  )
}