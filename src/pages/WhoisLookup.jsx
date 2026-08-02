import { useState, useCallback, useRef } from 'react'
import {
  Search,
  Copy,
  Loader2,
  ShieldCheck,
  Globe,
  CircleX,
  MapPin,
  TerminalSquare,
} from 'lucide-react'
import { SyncLoader } from 'react-spinners'
import PageHeader from '../components/ui/PageHeader'
import { getRdapRequest } from '../api/apiClient'

// RDAP endpoints
const RDAP_DOMAIN_BOOTSTRAP = 'https://rdap.org/domain/' //for domain query
const RDAP_IP_BOOTSTRAP = 'https://rdap.org/ip/' //for ip query

const REDACTED_LABEL = 'REDACTED FOR PRIVACY'

// Validation functions
function isValidHostname(h) {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(h)
}

function isValidIPv4(ip) {
  return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip)
}

function normaliseInput(raw) {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

// Detect if input is an IP or domain
function detectQueryType(input) {
  if (isValidIPv4(input)) return 'ip'
  if (isValidHostname(input)) return 'domain'
  return 'unknown'
}

// RDAP parsing helpers
function parseVcard(vcardArray) {
  const fields = vcardArray?.[1] ?? []
  const out = {}
  for (const [name, params, , value] of fields) {
    if (name === 'adr' && Array.isArray(value)) {
      out.adr = value.filter(Boolean).join(', ')
      out.country = params?.cc || value[6] || undefined
    } else if (name === 'tel') {
      out.tel = String(value).replace(/^tel:/, '')
    } else if (typeof value === 'string') {
      out[name] = value
    }
  }
  return out
}

function findEntity(entities = [], role) {
  return entities.find(e => e.roles?.includes(role))
}

function findEventDate(events = [], action) {
  return events.find(e => e.eventAction === action)?.eventDate ?? null
}

function formatDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric' 
    })
  } catch {
    return iso
  }
}

function isRedacted(value) {
  return typeof value === 'string' && /redact|privacy|withheld|not\s*disclosed/i.test(value)
}

// Returns the value as-is, REDACTED_LABEL if it's explicitly marked redacted,
// or null if the field simply wasn't provided at all (caller decides what to
// do with "not provided" — usually omit the line).
function fieldOrRedacted(value) {
  if (value === undefined || value === null || value === '') return null
  return isRedacted(value) ? REDACTED_LABEL : value
}

// Capitalize first letter of each word
function capitalizeWords(str) {
  if (!str) return str
  return str.split(' ').map(word => {
    if (word.length === 0) return word
    return word.charAt(0).toUpperCase() + word.slice(1)
  }).join(' ')
}

async function fetchRdapJson(url, signal) {
  const { data, success, error, status, message } = await getRdapRequest(
    url,
    {},
    { signal }
  )

  if (!success) {
    if (status === 404) {
      throw new Error('No RDAP record found for this query.')
    }
    if (status) {
      throw new Error(`RDAP server returned HTTP ${status}`)
    }
    throw error || new Error('RDAP request failed')
  }

  return data
}

function mergeEntities(primaryEntities = [], relatedEntities = []) {
  const keyFor = (e) => (e.roles ?? []).slice().sort().join(',')
  const merged = new Map()
  for (const e of primaryEntities) merged.set(keyFor(e), e)
  for (const e of relatedEntities) {
    const key = keyFor(e)
    const existing = merged.get(key)
    if (existing && key.includes('registrar') && !e.publicIds?.length && existing.publicIds?.length) {
      merged.set(key, { ...e, publicIds: existing.publicIds, entities: e.entities ?? existing.entities })
    } else {
      merged.set(key, e)
    }
  }
  return Array.from(merged.values())
}

async function fetchRdapDomain(domain, signal) {
  const primary = await fetchRdapJson(`${RDAP_DOMAIN_BOOTSTRAP}${domain}`, signal)
  const relatedLink = primary.links?.find(l => l.rel === 'related' && (!l.type || l.type.includes('rdap')))

  if (!relatedLink?.href) return primary

  try {
    const related = await fetchRdapJson(relatedLink.href, signal)
    return { ...primary, entities: mergeEntities(primary.entities, related.entities) }
  } catch {
    return primary
  }
}

async function fetchRdapIP(ip, signal) {
  return await fetchRdapJson(`${RDAP_IP_BOOTSTRAP}${ip}`, signal)
}

// Main lookup function that auto-detects query type
async function fetchRdap(input, signal) {
  const queryType = detectQueryType(input)

  if (queryType === 'domain') {
    return { data: await fetchRdapDomain(input, signal), type: 'domain' }
  } else if (queryType === 'ip') {
    return { data: await fetchRdapIP(input, signal), type: 'ip' }
  } else {
    throw new Error('Invalid input. Please enter a valid domain name or IPv4 address.')
  }
}

// Terminal-style renderer — both domain and IP lookups render as a full,
// plain-text dump of the RDAP response 
function RdapTextDisplay({ title, text }) {
  return (
    <div className="bg-black border border-borderColor rounded-2xl overflow-hidden font-mono">
      <div className="p-5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex justify-between items-start mb-3 min-w-max">
          <span className="text-xs text-white/60">{title}</span>
          <button
            onClick={() => navigator.clipboard.writeText(text)}
            className="text-white/60 hover:text-white transition-colors bg-transparent border-none cursor-pointer p-1 text-xs flex items-center gap-1"
          >
            <Copy size={12} />
            Copy All
          </button>
        </div>
        <pre className="text-xs text-white whitespace-pre font-mono">
          {text}
        </pre>
      </div>
    </div>
  )
}

// Builds one KV-style contact block (registrar / registrant / admin / tech /
// billing / reseller...) from an RDAP entity. If the entity is entirely
// absent, or every personal field on it is missing, the whole block is
// printed as REDACTED FOR PRIVACY — which is what's actually happening on
// most gTLD domains post-GDPR.
function pushContactBlock(push, kv, heading, entity) {
  push('')
  push(heading)
  push('-'.repeat(50))

  if (!entity) {
    push(REDACTED_LABEL)
    return
  }

  const vcard = parseVcard(entity.vcardArray)
  const fieldPairs = [
    ['Name', vcard.fn],
    ['Organization', vcard.org],
    ['Email', vcard.email],
    ['Phone', vcard.tel],
    ['Address', vcard.adr],
    ['Country', vcard.country],
  ]

  let printedAny = false

  // if (entity.handle) { 
  //   kv('Handle', entity.handle); 
  //   printedAny = true 
  // }

  fieldPairs.forEach(([label, raw]) => {
    const text = fieldOrRedacted(raw)
    if (text === null) return // field wasn't provided at all — omit rather than guess
    printedAny = true
    kv(label, text)
  })

  const ianaId = entity.publicIds?.find(p => p.type === 'IANA Registrar ID')?.identifier
  if (ianaId) { kv('IANA ID', ianaId); printedAny = true }

  const selfLink = entity.links?.find(l => l.rel === 'self')?.href
  if (selfLink) { kv('Reference', selfLink); printedAny = true }

  // if (entity.roles?.length) { 
  //   kv('Roles', entity.roles.join(', ')); 
  //   printedAny = true 
  // }

  // Nested sub-entities, e.g. a registrar's abuse contact
  ;(entity.entities || []).forEach(sub => {
    const subVcard = parseVcard(sub.vcardArray)
    const subRole = sub.roles?.[0] ? capitalizeWords(sub.roles[0]) : 'Contact'
    const email = fieldOrRedacted(subVcard.email)
    const tel = fieldOrRedacted(subVcard.tel)
    if (email !== null) { kv(`${subRole} Email`, email); printedAny = true }
    if (tel !== null) { kv(`${subRole} Phone`, tel); printedAny = true }
  })

  if (!printedAny) push(REDACTED_LABEL)
}

// Renders the ENTIRE RDAP domain response as plain text — every field the
// API returned, not a curated subset. Anything the registry marks redacted
// (or a whole contact the response omits for privacy) prints as
// "REDACTED FOR PRIVACY" instead of silently disappearing.
function buildDomainRdapText(data, queryInput) {
  const lines = []
  const push = (s = '') => lines.push(s)
  const kv = (label, value, width = 20) => {
    if (value === undefined || value === null || value === '') return
    push(`${(label + ':').padEnd(width)} ${value}`)
  }

  push('RDAP DOMAIN LOOKUP')
  push('='.repeat(50))
  push('')

  kv('Domain Name', data.ldhName ?? queryInput)
  if (data.unicodeName && data.unicodeName !== data.ldhName) kv('Unicode Name', data.unicodeName)
  kv('Registry Domain ID', data.handle)
  if (data.status?.length) kv('Status', data.status.map(s => capitalizeWords(s.replace(/_/g, ' '))).join(', '))
  // if (data.port43) kv('WHOIS Server', data.port43)
  // if (data.rdapConformance?.length) kv('RDAP Conformance', data.rdapConformance.join(', '))

  const regDate = formatDate(findEventDate(data.events, 'registration'))
  const expDate = formatDate(findEventDate(data.events, 'expiration'))
  const updDate = formatDate(findEventDate(data.events, 'last changed'))
  const transferDate = formatDate(findEventDate(data.events, 'transfer'))
  kv('Registered On', regDate)
  kv('Expires On', expDate)
  kv('Last Updated', updDate)
  kv('Last Transferred', transferDate)

  const knownActions = new Set(['registration', 'expiration', 'last changed', 'transfer'])
  ;(data.events || [])
    .filter(e => !knownActions.has(e.eventAction))
    .forEach(e => kv(capitalizeWords(e.eventAction.replace(/_/g, ' ')), formatDate(e.eventDate)))

  // DNSSEC
  if (data.secureDNS) {
    push('')
    push('DNSSEC')
    push('-'.repeat(50))
    kv('Zone Signed', data.secureDNS.zoneSigned ? 'Yes' : 'No')
    kv('Delegation Signed', data.secureDNS.delegationSigned ? 'Yes' : 'No')
  }

  // Nameservers
  if (data.nameservers?.length) {
    push('')
    push('Nameservers')
    push('-'.repeat(50))
    data.nameservers.forEach(ns => {
      const ips = [...(ns.ipAddresses?.v4 || []), ...(ns.ipAddresses?.v6 || [])]
      push(`  ${ns.ldhName}${ips.length ? '  (' + ips.join(', ') + ')' : ''}`)
    })
  }

  // Primary contact roles, always shown even when redacted/absent
  const roleOrder = ['registrar', 'reseller', 'registrant', 'administrative', 'technical', 'billing']
  const seenRoles = new Set(roleOrder)
  roleOrder.forEach(role => {
    pushContactBlock(push, kv, `${capitalizeWords(role)} Contact`, findEntity(data.entities, role))
  })

  // Any entity carrying a role we didn't already cover
  ;(data.entities || []).forEach(e => {
    const uncovered = (e.roles || []).filter(r => !seenRoles.has(r))
    if (uncovered.length === 0) return
    pushContactBlock(push, kv, `${capitalizeWords(uncovered.join(', '))} Contact`, e)
  })


  // Notices & remarks
  const notices = [...(data.notices || []), ...(data.remarks || [])]
  if (notices.length) {
    push('')
    push('Notices')
    push('-'.repeat(50))
    notices.forEach(n => {
      if (n.title) push(`${n.title}:`)
      ;(n.description || []).forEach(d => push(`  ${d}`))
    })
  }

  // Links
  if (data.links?.length) {
    push('')
    push('Links')
    push('-'.repeat(50))
    data.links.forEach(l => push(`  ${l.rel || 'link'}: ${l.href}`))
  }

  push('')
  push('='.repeat(50))
  push(`RDAP query for: ${queryInput}`)
  push('Data source: rdap.org')

  return lines.join('\n')
}

// Renders the ENTIRE RDAP IP-network response as plain text, same rules as the domain renderer above.
function buildIpRdapText(data, queryInput) {
  const ipNetwork = data?.ipNetwork || data
  const lines = []
  const push = (s = '') => lines.push(s)
  const kv = (label, value, width = 20) => {
    if (value === undefined || value === null || value === '') return
    push(`${(label + ':').padEnd(width)} ${value}`)
  }

  push('RDAP IP NETWORK LOOKUP')
  push('='.repeat(50))
  push('')

  if (ipNetwork.startAddress && ipNetwork.endAddress) {
    kv('Network Range', `${ipNetwork.startAddress} - ${ipNetwork.endAddress}`)
  }
  kv('CIDR', ipNetwork.cidr)
  kv('Network Name', ipNetwork.name)
  kv('Network Type', ipNetwork.type)
  kv('Country', data.country)
  if (data.status?.length) kv('Status', data.status.map(s => capitalizeWords(s.replace(/_/g, ' '))).join(', '))
  if (data.port43) kv('WHOIS Server', data.port43)
  if (data.rdapConformance?.length) kv('RDAP Conformance', data.rdapConformance.join(', '))

  const regDate = formatDate(findEventDate(data.events, 'registration'))
  const updDate = formatDate(findEventDate(data.events, 'last changed'))
  kv('Registration Date', regDate)
  kv('Last Updated', updDate)

  const knownActions = new Set(['registration', 'last changed'])
  ;(data.events || [])
    .filter(e => !knownActions.has(e.eventAction))
    .forEach(e => kv(capitalizeWords(e.eventAction.replace(/_/g, ' ')), formatDate(e.eventDate)))

  const selfLink = data.links?.find(l => l.rel === 'self')?.href
  if (selfLink) kv('Reference', selfLink)

  // Contact roles found on IP networks
  const roleOrder = ['registrant', 'administrative', 'technical', 'abuse']
  const seenRoles = new Set(roleOrder)
  roleOrder.forEach(role => {
    pushContactBlock(push, kv, `${capitalizeWords(role)} Contact`, findEntity(data.entities, role))
  })

  ;(data.entities || []).forEach(e => {
    const uncovered = (e.roles || []).filter(r => !seenRoles.has(r))
    if (uncovered.length === 0) return
    pushContactBlock(push, kv, `${capitalizeWords(uncovered.join(', '))} Contact`, e)
  })

  // Nameservers (occasionally present on IP network objects)
  if (data.nameservers?.length) {
    push('')
    push('Nameservers')
    push('-'.repeat(50))
    data.nameservers.forEach(ns => ns.ldhName && push(`  ${ns.ldhName}`))
  }

  const notices = [...(data.notices || []), ...(data.remarks || [])]
  if (notices.length) {
    push('')
    push('Notices')
    push('-'.repeat(50))
    notices.forEach(n => {
      if (n.title) push(`${n.title}:`)
      ;(n.description || []).forEach(d => push(`  ${d}`))
    })
  }

  if (data.links?.length) {
    push('')
    push('Links')
    push('-'.repeat(50))
    data.links.forEach(l => push(`  ${l.rel || 'link'}: ${l.href}`))
  }

  push('')
  push('='.repeat(50))
  push(`RDAP query for: ${queryInput}`)
  push('Data source: rdap.org')

  return lines.join('\n')
}

export default function WhoisLookup() {
  const [inputValue, setInputValue] = useState('')
  const [queryInput, setQueryInput] = useState('')
  const [rdapData, setRdapData] = useState(null)
  const [queryType, setQueryType] = useState(null) // 'domain' or 'ip'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const runLookup = useCallback(async () => {
    const target = normaliseInput(inputValue)

    if (!target) {
      setError('Please enter a domain name or IP address.')
      return
    }

    const detectedType = detectQueryType(target)
    if (detectedType === 'unknown') {
      setError(`"${target}" doesn't look like a valid domain name or IPv4 address.`)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setQueryInput(target)
    setRdapData(null)
    setQueryType(null)

    try {
      const result = await fetchRdap(target, controller.signal)
      setRdapData(result.data)
      setQueryType(result.type)
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message ?? 'Lookup failed.')
    } finally {
      setLoading(false)
    }
  }, [inputValue])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') runLookup()
  }

  const isIPQuery = queryType === 'ip'

  const outputText = rdapData
    ? (isIPQuery ? buildIpRdapText(rdapData, queryInput) : buildDomainRdapText(rdapData, queryInput))
    : ''

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <PageHeader
        title="WHOIS Lookup"
        description="Look up domain registration via RDAP — works with both domain names and IPv4 addresses."
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
            placeholder="example.com or 8.8.8.8"
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

      {/* Query type indicator */}
      {queryType && rdapData && !loading && (
        <div className="mb-4 flex items-center gap-2 text-xs">
          <span className="text-text">Query type:</span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
            isIPQuery
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          }`}>
            {isIPQuery ? <MapPin size={12} /> : <Globe size={12} />}
            {isIPQuery ? 'IP Address' : 'Domain Name'}
          </span>
        </div>
      )}

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

      {/* Data loader */}
      {!rdapData && loading && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <SyncLoader color="#3B5BDB" size={13} />
          <p className="text-sm text-textHeader font-medium m-0 pt-2">Fetching Data...</p>
        </div>
      )}

      {/* Results — rendered as a full plain-text dump of the RDAP response */}
      {rdapData && !loading && (
        <RdapTextDisplay title="RDAP Plain Text Format" text={outputText} />
      )}

      {/* Empty state */}
      {!rdapData && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <TerminalSquare size={32} className="text-accent mx-auto mb-2.5 sm:mb-3 sm:size-10" />
          <p className="text-sm text-textHeader font-medium m-0 mb-1">Enter a domain or IP to get started</p>
          <p className="text-xs text-text m-0 max-w-xs">
            Try <code className="font-mono text-accent">cloudflare.com</code> or{' '}
            <code className="font-mono text-accent">8.8.8.8</code>
          </p>
        </div>
      )}
    </div>
  )
}