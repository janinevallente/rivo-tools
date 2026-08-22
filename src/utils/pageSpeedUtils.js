// PageSpeed Insights (v5) helpers — API key storage, request construction,
// and parsing of the (large, deeply nested) Lighthouse + CrUX payload into
// flat structures the UI can render without re-walking the raw JSON.
export const PAGESPEED_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
export const PAGESPEED_API_KEY = import.meta.env.VITE_PAGESPEED_API_KEY || ''

export const CATEGORY_IDS = ['performance', 'accessibility', 'best-practices', 'seo']

export const CATEGORY_LABELS = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  'best-practices': 'Best Practices',
  seo: 'SEO',
}

// Request building
export function normaliseUrl(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function buildPsiUrl(targetUrl, strategy, apiKey) {
  const params = new URLSearchParams()
  params.append('url', targetUrl)
  params.append('strategy', strategy)
  CATEGORY_IDS.forEach(c => params.append('category', c))
  if (apiKey) params.append('key', apiKey)
  return `${PAGESPEED_API}?${params.toString()}`
}

// Formatting
export function formatMs(ms) {
  if (ms == null) return '—'
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)} s`
  return `${Math.round(ms)} ms`
}

export function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

export function formatCount(n) {
  if (n == null) return '—'
  return n.toLocaleString()
}

// Renders whatever unit Lighthouse tags a numeric audit value with.
export function formatAuditValue(numericValue, numericUnit) {
  if (numericValue == null) return null
  switch (numericUnit) {
    case 'millisecond': return formatMs(numericValue)
    case 'byte': return formatBytes(numericValue)
    default: return `${numericValue}`
  }
}

// Score helpers — 0-1 scale from Lighthouse, bucketed the same way the
// official report colors things: 90-100 good, 50-89 needs improvement, 0-49 poor.
export function scoreToBucket(score) {
  if (score == null) return 'unknown'
  const pct = score * 100
  if (pct >= 90) return 'good'
  if (pct >= 50) return 'average'
  return 'poor'
}

export const BUCKET_COLORS = {
  good: { text: 'text-success', bg: 'bg-successBg', border: 'border-successBorder', hex: 'var(--color-success)' },
  average: { text: 'text-warning', bg: 'bg-warningBg', border: 'border-warningBorder', hex: 'var(--color-warning)' },
  poor: { text: 'text-error', bg: 'bg-errorBg', border: 'border-errorBorder', hex: 'var(--color-error)' },
  unknown: { text: 'text-text', bg: 'bg-backgroundColor', border: 'border-borderColor', hex: 'var(--color-text-secondary)' },
}

export const BUCKET_LABELS = { good: 'Good', average: 'Needs Improvement', poor: 'Poor', unknown: 'N/A' }

// CrUX field data uses FAST/AVERAGE/SLOW instead of good/average/poor
const CRUX_BUCKET_MAP = { FAST: 'good', AVERAGE: 'average', SLOW: 'poor' }
export function cruxCategoryToBucket(category) {
  return CRUX_BUCKET_MAP[category] || 'unknown'
}

// Field data (Chrome UX Report) — normalises loadingExperience /
// originLoadingExperience into a flat, orderable metric list, keeping the
// full 3-bucket distribution so it can render Good/NI/Poor bars (something
// the stock report only shows for the single "primary" metric it picks).
const FIELD_METRIC_ORDER = [
  'LARGEST_CONTENTFUL_PAINT_MS',
  'INTERACTION_TO_NEXT_PAINT',
  'CUMULATIVE_LAYOUT_SHIFT_SCORE',
  'FIRST_CONTENTFUL_PAINT_MS',
  'EXPERIMENTAL_TIME_TO_FIRST_BYTE',
  'FIRST_INPUT_DELAY_MS',
]

const FIELD_METRIC_META = {
  LARGEST_CONTENTFUL_PAINT_MS: { label: 'Largest Contentful Paint', short: 'LCP', unit: 'ms', coreWebVital: true },
  INTERACTION_TO_NEXT_PAINT: { label: 'Interaction to Next Paint', short: 'INP', unit: 'ms', coreWebVital: true },
  CUMULATIVE_LAYOUT_SHIFT_SCORE: { label: 'Cumulative Layout Shift', short: 'CLS', unit: 'score', coreWebVital: true },
  FIRST_CONTENTFUL_PAINT_MS: { label: 'First Contentful Paint', short: 'FCP', unit: 'ms', coreWebVital: false },
  EXPERIMENTAL_TIME_TO_FIRST_BYTE: { label: 'Time to First Byte', short: 'TTFB', unit: 'ms', coreWebVital: false },
  FIRST_INPUT_DELAY_MS: { label: 'First Input Delay', short: 'FID', unit: 'ms', coreWebVital: false },
}

export function extractFieldData(loadingExperience) {
  if (!loadingExperience?.metrics) return null
  const metrics = FIELD_METRIC_ORDER
    .filter(key => loadingExperience.metrics[key])
    .map(key => {
      const m = loadingExperience.metrics[key]
      const meta = FIELD_METRIC_META[key]
      const value = meta.unit === 'score' ? m.percentile / 100 : m.percentile
      return {
        key,
        ...meta,
        percentile: m.percentile,
        displayValue: meta.unit === 'score' ? value.toFixed(2) : formatMs(m.percentile),
        bucket: cruxCategoryToBucket(m.category),
        distributions: (m.distributions || []).map(d => ({ ...d, proportion: d.proportion * 100 })),
      }
    })
  return {
    overallCategory: cruxCategoryToBucket(loadingExperience.overall_category),
    metrics,
  }
}

// Performance audits — split into lab metrics, opportunities, diagnostics,
// and passed audits using the auditRefs groupings Lighthouse itself defines.
const KEY_LAB_METRICS = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index',
  'interactive',
]

export function groupPerformanceAudits(lighthouseResult) {
  const audits = lighthouseResult?.audits || {}
  const perfCategory = lighthouseResult?.categories?.performance
  const auditRefs = perfCategory?.auditRefs || []

  const labMetrics = KEY_LAB_METRICS
    .filter(id => audits[id])
    .map(id => {
      const ref = auditRefs.find(r => r.id === id)
      return { id, weight: ref?.weight ?? 0, ...audits[id] }
    })

  const opportunities = []
  const diagnostics = []
  const passed = []
  const seen = new Set()

  auditRefs.forEach(ref => {
    const audit = audits[ref.id]
    if (!audit || seen.has(ref.id) || KEY_LAB_METRICS.includes(ref.id)) return
    seen.add(ref.id)

    if (audit.scoreDisplayMode === 'notApplicable' || audit.scoreDisplayMode === 'manual') return

    if (ref.group === 'load-opportunities' && audit.details?.type === 'opportunity') {
      opportunities.push({ id: ref.id, ...audit })
    } else if (ref.group === 'diagnostics') {
      diagnostics.push({ id: ref.id, ...audit })
    } else if (audit.score === 1 || audit.scoreDisplayMode === 'informative') {
      passed.push({ id: ref.id, ...audit })
    }
  })

  opportunities.sort((a, b) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))
  diagnostics.sort((a, b) => (a.score ?? 1) - (b.score ?? 1))

  return { labMetrics, opportunities, diagnostics, passed }
}

// Non-performance categories (Accessibility, Best Practices, SEO) — grouped
// by Lighthouse's own categoryGroups (e.g. "Contrast", "Names & Labels",
// "ARIA") rather than dumped as one flat list.
export function groupCategoryAudits(lighthouseResult, categoryId) {
  const audits = lighthouseResult?.audits || {}
  const category = lighthouseResult?.categories?.[categoryId]
  const categoryGroups = lighthouseResult?.categoryGroups || {}
  if (!category) return { score: null, groups: [], manual: [], notApplicable: [] }

  const groupsMap = new Map()
  const manual = []
  const notApplicable = []

  category.auditRefs.forEach(ref => {
    const audit = audits[ref.id]
    if (!audit) return

    if (audit.scoreDisplayMode === 'manual') {
      manual.push({ id: ref.id, ...audit })
      return
    }
    if (audit.scoreDisplayMode === 'notApplicable') {
      notApplicable.push({ id: ref.id, ...audit })
      return
    }

    const groupId = ref.group || 'other'
    const groupLabel = categoryGroups[groupId]?.title || 'Other'
    if (!groupsMap.has(groupId)) groupsMap.set(groupId, { id: groupId, label: groupLabel, audits: [] })
    groupsMap.get(groupId).audits.push({ id: ref.id, weight: ref.weight, ...audit })
  })

  const groups = Array.from(groupsMap.values()).map(g => ({
    ...g,
    audits: g.audits.sort((a, b) => (a.score ?? 1) - (b.score ?? 1)),
    failedCount: g.audits.filter(a => a.score !== 1).length,
  }))
  groups.sort((a, b) => b.failedCount - a.failedCount)

  return { score: category.score, groups, manual, notApplicable }
}

// Misc extractors used by dedicated sections
export function getResourceSummary(lighthouseResult) {
  return lighthouseResult?.audits?.['resource-summary']?.details?.items || null
}

export function getThirdPartySummary(lighthouseResult) {
  return lighthouseResult?.audits?.['third-party-summary']?.details || null
}

export function getMainThreadBreakdown(lighthouseResult) {
  return lighthouseResult?.audits?.['mainthread-work-breakdown']?.details || null
}

export function getNetworkRequests(lighthouseResult) {
  return lighthouseResult?.audits?.['network-requests']?.details || null
}

export function getScreenshotThumbnails(lighthouseResult) {
  return lighthouseResult?.audits?.['screenshot-thumbnails']?.details?.items || null
}

export function getFinalScreenshot(lighthouseResult) {
  return lighthouseResult?.audits?.['final-screenshot']?.details?.data || null
}

export function getStackPacks(lighthouseResult) {
  return lighthouseResult?.stackPacks || []
}

export function getDomSize(lighthouseResult) {
  return lighthouseResult?.audits?.['dom-size']?.details || null
}

// Generic Lighthouse `details.items` table rendering — audits carry wildly
// different shapes, but items are always tagged with an itemType per
// heading, so a single formatter can handle the vast majority of them.
export function formatDetailItem(value, itemType) {
  if (value == null || value === '') return '—'
  switch (itemType) {
    case 'bytes': return formatBytes(Number(value))
    case 'ms':
    case 'timespanMs': return formatMs(Number(value))
    case 'url': {
      const str = String(value)
      try {
        const u = new URL(str)
        const path = u.pathname + u.search
        return path.length > 60 ? `${u.hostname}${path.slice(0, 57)}…` : `${u.hostname}${path}`
      } catch {
        return str.length > 70 ? `${str.slice(0, 67)}…` : str
      }
    }
    case 'text':
    case 'node':
      return typeof value === 'object' ? (value.snippet || value.selector || JSON.stringify(value)) : String(value)
    case 'code':
      return typeof value === 'object' ? JSON.stringify(value) : String(value)
    case 'link':
      return typeof value === 'object' ? (value.text || value.url) : String(value)
    default:
      if (typeof value === 'number') return value.toLocaleString()
      if (typeof value === 'object') return value.value ?? value.text ?? JSON.stringify(value)
      return String(value)
  }
}

// Flattens a Lighthouse details block (table/opportunity shape) into
// { headings: [{key,label}], rows: [{...}] } ready for a <table>.
export function normaliseDetailsTable(details) {
  if (!details || !Array.isArray(details.items) || details.items.length === 0) return null
  const headings = (details.headings && details.headings.length > 0)
    ? details.headings.map(h => ({ key: h.key, label: h.label || h.text || h.key, itemType: h.itemType || h.valueType }))
    : Object.keys(details.items[0]).map(k => ({ key: k, label: k, itemType: undefined }))

  const rows = details.items.map(item => {
    const row = {}
    headings.forEach(h => { row[h.key] = formatDetailItem(item[h.key], h.itemType) })
    return row
  })

  return { headings, rows }
}