import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { SyncLoader } from 'react-spinners'
import PageHeader from '../components/ui/PageHeader'
import { getRequest } from '../api/apiClient'
import { TOOL_CACHE_KEYS, saveToolCache, loadToolCache } from '../utils/toolResultCache'
import {
  CATEGORY_IDS,
  CATEGORY_LABELS,
  PAGESPEED_API_KEY,
  normaliseUrl,
  buildPsiUrl,
  formatMs,
  formatBytes,
  formatCount,
  formatAuditValue,
  scoreToBucket,
  BUCKET_COLORS,
  BUCKET_LABELS,
  extractFieldData,
  groupPerformanceAudits,
  groupCategoryAudits,
  getResourceSummary,
  getThirdPartySummary,
  getMainThreadBreakdown,
  getNetworkRequests,
  getScreenshotThumbnails,
  getFinalScreenshot,
  getStackPacks,
  getDomSize,
  normaliseDetailsTable,
} from '../utils/pageSpeedUtils'
import {
  Gauge,
  Search,
  Loader2,
  Smartphone,
  Monitor,
  Key,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleAlert,
  CircleX,
  Info,
  Download,
  ExternalLink,
  Zap,
  Accessibility,
  ShieldCheck,
  FileSearch,
  Users,
  FlaskConical,
  Boxes,
  Puzzle,
  Film,
} from 'lucide-react'

const CATEGORY_ICONS = {
  performance: Zap,
  accessibility: Accessibility,
  'best-practices': ShieldCheck,
  seo: FileSearch,
}

async function runPageSpeed(targetUrl, strategy, apiKey, signal) {
  const url = buildPsiUrl(targetUrl, strategy, apiKey)
  const { data, success, error } = await getRequest(url, {}, {}, { signal })
  if (!success) {
    const status = error?.response?.status
    const apiMessage = error?.response?.data?.error?.message
    throw new Error(apiMessage || (status ? `PageSpeed API error (HTTP ${status})` : error?.message ?? 'PageSpeed request failed.'))
  }
  return data
}

// Small presentational pieces
function ScoreRing({ score, size = 88, label }) {
  const bucket = scoreToBucket(score)
  const colors = BUCKET_COLORS[bucket]
  const pct = score == null ? null : Math.round(score * 100)
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  const offset = pct == null ? c : c - (pct / 100) * c

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth="7" />
          {pct != null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={colors.hex}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.7s ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-bold ${colors.text}`}>{pct ?? '—'}</span>
        </div>
      </div>
      {label && <span className="text-xs font-medium text-textHeader text-center leading-tight">{label}</span>}
    </div>
  )
}

function BucketBadge({ bucket, children }) {
  const colors = BUCKET_COLORS[bucket]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${colors.bg} ${colors.text} border ${colors.border}`}>
      {children ?? BUCKET_LABELS[bucket]}
    </span>
  )
}

function Section({ icon: Icon, title, subtitle, defaultOpen = true, children, count }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-backgroundCard border border-borderColor rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2.5 px-5 py-4 bg-transparent border-none cursor-pointer text-left hover:bg-backgroundColor transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon size={16} className="text-accent shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-textHeader m-0">
              {title}
              {count != null && <span className="text-text font-normal"> ({count})</span>}
            </h2>
            {subtitle && <p className="text-xs text-text m-0 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {open ? <ChevronUp size={15} className="text-text shrink-0" /> : <ChevronDown size={15} className="text-text shrink-0" />}
      </button>
      {open && <div className="border-t border-borderColor">{children}</div>}
    </div>
  )
}

function DetailsTable({ table }) {
  const [showAll, setShowAll] = useState(false)
  if (!table) return null
  const rows = showAll ? table.rows : table.rows.slice(0, 8)
  return (
    <div className="overflow-x-auto rounded-lg border border-borderColor">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-backgroundColor">
            {table.headings.map(h => (
              <th key={h.key} className="text-left font-semibold text-text uppercase tracking-wide px-3 py-2 border-b border-borderColor whitespace-nowrap">
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-backgroundColor transition-colors">
              {table.headings.map(h => (
                <td key={h.key} className="px-3 py-2 border-b border-borderColor last:border-b-0 text-textHeader font-mono align-top break-all">
                  {String(row[h.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > 8 && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="w-full text-center text-xs text-accent font-medium py-2 bg-transparent border-none cursor-pointer hover:underline"
        >
          {showAll ? 'Show less' : `Show ${table.rows.length - 8} more rows`}
        </button>
      )}
    </div>
  )
}

// Renders Lighthouse audit description text with any embedded markdown
// links (e.g. "... [Learn more](https://web.dev/...)") turned into real,
// clickable anchors instead of being stripped down to plain text.
function LinkedText({ text }) {
  if (!text) return null
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g
  const nodes = []
  let lastIndex = 0
  let match
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    nodes.push(
      <a
        key={key++}
        href={match[2]}
        target="_blank"
        rel="noreferrer"
        onClick={e => e.stopPropagation()}
        className="text-accent underline hover:no-underline"
      >
        {match[1]}
      </a>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))

  return <>{nodes}</>
}

function AuditRow({ audit }) {
  const [open, setOpen] = useState(false)
  const bucket = scoreToBucket(audit.score)
  const table = normaliseDetailsTable(audit.details)
  const Icon = audit.score === 1 ? CircleCheck : audit.score == null ? Info : audit.score >= 0.5 ? CircleAlert : CircleX
  const savings = audit.details?.overallSavingsMs
    ? `${formatMs(audit.details.overallSavingsMs)} savings`
    : audit.details?.overallSavingsBytes
      ? `${formatBytes(audit.details.overallSavingsBytes)} savings`
      : null

  return (
    <div className="border-b border-borderColor last:border-b-0">
      <button
        onClick={() => table && setOpen(o => !o)}
        className={`w-full flex items-start gap-2.5 px-5 py-3 text-left bg-transparent border-none transition-colors ${table ? 'cursor-pointer hover:bg-backgroundColor' : 'cursor-default'}`}
      >
        <Icon size={15} className={`shrink-0 mt-0.5 ${BUCKET_COLORS[bucket].text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-textHeader">{audit.title}</span>
            {audit.displayValue && <span className="text-xs text-text font-mono">{audit.displayValue}</span>}
            {savings && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accentBg text-accent">{savings}</span>}
          </div>
          {audit.description && (
            <p className="text-xs text-text m-0 mt-1 leading-relaxed">
              <LinkedText text={audit.description} />
            </p>
          )}
        </div>
        {table && (open ? <ChevronUp size={14} className="text-text shrink-0 mt-0.5" /> : <ChevronDown size={14} className="text-text shrink-0 mt-0.5" />)}
      </button>
      {open && table && (
        <div className="px-5 pb-4">
          <DetailsTable table={table} />
        </div>
      )}
    </div>
  )
}

function FieldMetricCard({ metric }) {
  return (
    <div className="p-3.5 rounded-xl border border-borderColor bg-backgroundColor">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-xs font-semibold text-textHeader">{metric.short}</span>
        <BucketBadge bucket={metric.bucket} />
      </div>
      <p className="text-lg font-bold text-textHeader m-0 mb-0.5">{metric.displayValue}</p>
      <p className="text-[11px] text-text m-0 mb-2 leading-tight">
        {metric.label}
        {metric.coreWebVital && <span className="text-accent"> · Core Web Vital</span>}
      </p>
      {metric.distributions.length > 0 && (
        <div className="flex h-1.5 rounded-full overflow-hidden gap-px" title="Good / Needs improvement / Poor distribution across real users">
          {metric.distributions.map((d, i) => (
            <div
              key={i}
              style={{
                width: `${Math.max(d.proportion, d.proportion > 0 ? 1 : 0)}%`,
                backgroundColor: i === 0 ? 'var(--color-success)' : i === 1 ? 'var(--color-warning)' : 'var(--color-error)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LabMetricCard({ audit }) {
  const bucket = scoreToBucket(audit.score)
  return (
    <div className="p-3.5 rounded-xl border border-borderColor bg-backgroundColor">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-xs font-semibold text-textHeader">{audit.title}</span>
        <BucketBadge bucket={bucket} />
      </div>
      <p className="text-lg font-bold text-textHeader m-0">{audit.displayValue || formatAuditValue(audit.numericValue, audit.numericUnit)}</p>
    </div>
  )
}

function ResourceBreakdown({ items }) {
  const totalRow = items.find(i => i.resourceType === 'total')
  const rows = items.filter(i => i.resourceType !== 'total').sort((a, b) => b.transferSize - a.transferSize)
  const total = totalRow?.transferSize || rows.reduce((s, i) => s + (i.transferSize || 0), 0)

  return (
    <div className="px-5 py-4 flex flex-col gap-3">
      {totalRow && (
        <div className="flex items-center justify-between text-xs pb-2 border-b border-borderColor">
          <span className="text-textHeader font-semibold">Total page weight</span>
          <span className="text-textHeader font-mono font-semibold">
            {formatCount(totalRow.requestCount)} requests · {formatBytes(totalRow.transferSize)}
          </span>
        </div>
      )}
      {rows.map(r => (
        <div key={r.resourceType}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-textHeader font-medium capitalize">{r.resourceType.toLowerCase().replace(/-/g, ' ')}</span>
            <span className="text-text font-mono">
              {formatCount(r.requestCount)} req · {formatBytes(r.transferSize)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-backgroundColor overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${total ? (r.transferSize / total) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function CategoryGroupAccordion({ group }) {
  const [open, setOpen] = useState(group.failedCount > 0)
  return (
    <div className="border-b border-borderColor last:border-b-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-5 py-3 bg-transparent border-none cursor-pointer text-left hover:bg-backgroundColor transition-colors"
      >
        <span className="text-sm font-medium text-textHeader">{group.label}</span>
        <div className="flex items-center gap-2 shrink-0">
          {group.failedCount > 0 ? (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-errorBg text-error border border-errorBorder whitespace-nowrap">
              {group.failedCount} failed
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-successBg text-success border border-successBorder whitespace-nowrap">
              All passed
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-text" /> : <ChevronDown size={14} className="text-text" />}
        </div>
      </button>
      {open && <div>{group.audits.map(a => <AuditRow key={a.id} audit={a} />)}</div>}
    </div>
  )
}

function CategoryReport({ report }) {
  if (!report) return null
  return (
    <div className="flex flex-col gap-5">
      <Section icon={Boxes} title="Audit Groups" subtitle="Grouped the same way Lighthouse organizes them, worst offenders first.">
        {report.groups.length > 0 ? (
          report.groups.map(g => <CategoryGroupAccordion key={g.id} group={g} />)
        ) : (
          <p className="text-xs text-text m-0 px-5 py-4">No scored audits returned for this category.</p>
        )}
      </Section>

      {report.manual.length > 0 && (
        <Section icon={Users} title="Needs Manual Review" subtitle="Lighthouse can't verify these automatically." defaultOpen={false} count={report.manual.length}>
          {report.manual.map(a => <AuditRow key={a.id} audit={a} />)}
        </Section>
      )}

      {report.notApplicable.length > 0 && (
        <Section icon={Info} title="Not Applicable" subtitle="Didn't apply to this page." defaultOpen={false} count={report.notApplicable.length}>
          {report.notApplicable.map(a => <AuditRow key={a.id} audit={a} />)}
        </Section>
      )}
    </div>
  )
}

export default function PageSpeedInsights() {
  const [inputValue, setInputValue] = useState('')
  const [strategy, setStrategy] = useState('desktop')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [activeTab, setActiveTab] = useState('performance')
  const abortRef = useRef(null)

  // Restore the last analysis on mount, so switching over to another tool
  // and back doesn't force a re-run.
  // This mirrors whatever the last *terminal* state was — success or an
  // error — never a stale success left over from an earlier run.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = await loadToolCache(TOOL_CACHE_KEYS.PAGESPEED_INSIGHTS)
      if (cancelled || !cached) return
      if (cached.inputValue) setInputValue(cached.inputValue)
      if (cached.strategy) setStrategy(cached.strategy)
      if (cached.activeTab) setActiveTab(cached.activeTab)
      setResult(cached.result ?? null)
      setError(cached.error ?? null)
    })()
    return () => { cancelled = true }
  }, [])

  const runAnalysis = useCallback(async () => {
    const target = normaliseUrl(inputValue)

    // Clear any previous result up front, before validation — otherwise a
    // failed re-query (empty input, missing API key, or a real PSI failure)
    // leaves the last successful analysis rendered underneath the error
    // banner instead of replacing it.
    setResult(null)

    if (!target) {
      setError('Please enter a URL to analyze.')
      return
    }
    if (!PAGESPEED_API_KEY) {
      setError('No PageSpeed API key is configured. Set VITE_PAGESPEED_API_KEY in the .env file and restart the dev server.')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setActiveTab('performance')

    try {
      const data = await runPageSpeed(target, strategy, PAGESPEED_API_KEY, controller.signal)
      setResult(data)
      await saveToolCache(TOOL_CACHE_KEYS.PAGESPEED_INSIGHTS, {
        inputValue: target, strategy, result: data, activeTab: 'performance', error: null,
      })
    } catch (err) {
      if (err.name === 'AbortError') return
      const message = err.message || 'PageSpeed analysis failed.'
      setError(message)
      // A failed run is still a terminal state — overwrite the cache so a
      // tool switch and back shows this failure, not the previous success.
      await saveToolCache(TOOL_CACHE_KEYS.PAGESPEED_INSIGHTS, {
        inputValue: target, strategy, result: null, activeTab: 'performance', error: message,
      })
    } finally {
      setLoading(false)
    }
  }, [inputValue, strategy])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') runAnalysis()
  }

  const lh = result?.lighthouseResult

  const scores = useMemo(
    () => CATEGORY_IDS.map(id => ({ id, label: CATEGORY_LABELS[id], score: lh?.categories?.[id]?.score })),
    [lh]
  )
  const fieldData = useMemo(() => extractFieldData(result?.loadingExperience), [result])
  const originFieldData = useMemo(() => extractFieldData(result?.originLoadingExperience), [result])
  const perf = useMemo(() => (lh ? groupPerformanceAudits(lh) : null), [lh])
  const categoryReports = useMemo(() => ({
    accessibility: lh ? groupCategoryAudits(lh, 'accessibility') : null,
    'best-practices': lh ? groupCategoryAudits(lh, 'best-practices') : null,
    seo: lh ? groupCategoryAudits(lh, 'seo') : null,
  }), [lh])
  const resourceSummary = useMemo(() => (lh ? getResourceSummary(lh) : null), [lh])
  const thirdParty = useMemo(() => (lh ? normaliseDetailsTable(getThirdPartySummary(lh)) : null), [lh])
  const mainThread = useMemo(() => (lh ? normaliseDetailsTable(getMainThreadBreakdown(lh)) : null), [lh])
  const networkRequests = useMemo(() => (lh ? normaliseDetailsTable(getNetworkRequests(lh)) : null), [lh])
  const domSize = useMemo(() => (lh ? normaliseDetailsTable(getDomSize(lh)) : null), [lh])
  const filmstrip = useMemo(() => (lh ? getScreenshotThumbnails(lh) : null), [lh])
  const finalScreenshot = useMemo(() => (lh ? getFinalScreenshot(lh) : null), [lh])
  const stackPacks = useMemo(() => (lh ? getStackPacks(lh) : []), [lh])

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - PageSpeed Insights</title>
      </Helmet>
      <PageHeader
        title="PageSpeed Insights"
        description="Full Lighthouse + Chrome UX Report diagnostics for any page — performance, accessibility, best practices, and SEO."
      />

      {/* API key notice — configured once by the developer via .env, never entered by end users */}
      {!PAGESPEED_API_KEY && (
        <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-warningBg border border-warningBorder">
          <Key size={15} className="text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-text m-0 leading-relaxed">
            <span className="text-warning font-semibold">No API key configured.</span>{' '}
            Set <code className="font-mono text-textHeader">VITE_PAGESPEED_API_KEY</code> in the project's{' '}
            <code className="font-mono text-textHeader">.env</code> file (get a free key from{' '}
            <a
              href="https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline"
            >
              Google Cloud Console
            </a>
            ) and restart the dev server.
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
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

        <div className="flex items-center gap-1 p-1 rounded-xl bg-backgroundCard border border-borderColor shrink-0">
          <button
            onClick={() => setStrategy('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-none cursor-pointer transition-colors ${strategy === 'mobile' ? 'bg-accent text-white' : 'bg-transparent text-text hover:text-textHeader'}`}
          >
            <Smartphone size={13} /> Mobile
          </button>
          <button
            onClick={() => setStrategy('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-none cursor-pointer transition-colors ${strategy === 'desktop' ? 'bg-accent text-white' : 'bg-transparent text-text hover:text-textHeader'}`}
          >
            <Monitor size={13} /> Desktop
          </button>
        </div>

        <button
          onClick={() => runAnalysis()}
          disabled={loading || !PAGESPEED_API_KEY}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Gauge size={14} />}
          Analyze
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-400/30 flex items-start gap-2.5">
          <CircleX size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400 font-medium m-0">Analysis failed</p>
            <p className="text-xs text-red-400/80 m-0 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loader */}
      {!result && loading && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <SyncLoader color="#3B5BDB" size={13} />
          <p className="text-sm text-textHeader font-medium m-0 pt-2">Running Lighthouse audit…</p>
          <p className="text-xs text-text m-0">This can take up to 30 seconds, especially for larger pages.</p>
        </div>
      )}

      {/* Results */}
      {lh && !loading && !error && (
        <div className="flex flex-col gap-5">
          {/* Summary bar */}
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            {finalScreenshot && (
              <img
                src={finalScreenshot}
                alt="Final page screenshot"
                className="w-20 h-auto rounded-lg border border-borderColor shrink-0 self-start"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium text-textHeader break-all">
                {lh.finalUrl}
                <a href={lh.finalUrl} target="_blank" rel="noreferrer" className="text-text hover:text-accent shrink-0">
                  <ExternalLink size={12} />
                </a>
              </div>
              <p className="text-xs text-text m-0 mt-1">
                Analyzed {lh.fetchTime ? new Date(lh.fetchTime).toLocaleString() : 'just now'} · {strategy === 'mobile' ? 'Mobile' : 'Desktop'} emulation · Lighthouse {lh.lighthouseVersion}
              </p>
            </div>
          </div>

          {/* Score gauges */}
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 flex flex-wrap justify-around gap-6">
            {scores.map(s => (
              <ScoreRing key={s.id} score={s.score} label={s.label} />
            ))}
          </div>

          {/* Stack packs */}
          {stackPacks.length > 0 && (
            <Section icon={Puzzle} title="Detected Technologies" subtitle="Stack-specific recommendations from Lighthouse.">
              <div className="px-5 py-4 flex flex-col gap-4">
                {stackPacks.map(pack => (
                  <div key={pack.id} className="flex items-start gap-3">
                    {pack.iconDataURL && <img src={pack.iconDataURL} alt="" className="w-6 h-6 shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-textHeader m-0 mb-1">{pack.title}</p>
                      <ul className="text-xs text-text m-0 pl-4 flex flex-col gap-1">
                        {Object.entries(pack.descriptions || {}).map(([auditId, desc]) => (
                          <li key={auditId}><LinkedText text={desc} /></li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-backgroundCard border border-borderColor overflow-x-auto">
            {CATEGORY_IDS.map(id => {
              const Icon = CATEGORY_ICONS[id]
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border-none cursor-pointer transition-colors whitespace-nowrap shrink-0 ${activeTab === id ? 'bg-accent text-white' : 'bg-transparent text-text hover:text-textHeader'}`}
                >
                  <Icon size={13} /> {CATEGORY_LABELS[id]}
                </button>
              )
            })}
          </div>

          {/* Performance tab */}
          {activeTab === 'performance' && perf && (
            <div className="flex flex-col gap-5">
              {(fieldData || originFieldData) && (
                <Section icon={Users} title="Field Data" subtitle="Real Chrome-user experience from the last 28 days (Chrome UX Report).">
                  <div className="px-5 py-4 flex flex-col gap-4">
                    {fieldData && (
                      <div>
                        <p className="text-[11px] font-semibold tracking-wide text-text uppercase mb-2">This page</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {fieldData.metrics.map(m => <FieldMetricCard key={m.key} metric={m} />)}
                        </div>
                      </div>
                    )}
                    {originFieldData && (
                      <div>
                        <p className="text-[11px] font-semibold tracking-wide text-text uppercase mb-2 mt-1">Entire origin</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {originFieldData.metrics.map(m => <FieldMetricCard key={m.key} metric={m} />)}
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              )}
              {!fieldData && !originFieldData && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-backgroundCard border border-borderColor">
                  <Info size={15} className="text-text shrink-0 mt-0.5" />
                  <p className="text-xs text-text m-0 leading-relaxed">
                    No field data available — this URL doesn't have enough real-user Chrome traffic in the CrUX dataset. Lab data below is still fully representative of a simulated load.
                  </p>
                </div>
              )}

              <Section icon={FlaskConical} title="Lab Data" subtitle="Simulated Lighthouse run on this analysis.">
                <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {perf.labMetrics.map(a => <LabMetricCard key={a.id} audit={a} />)}
                </div>
              </Section>

              <Section icon={Zap} title="Opportunities" subtitle="Suggestions estimated to speed up page load, ranked by impact." count={perf.opportunities.length}>
                {perf.opportunities.length > 0 ? (
                  perf.opportunities.map(a => <AuditRow key={a.id} audit={a} />)
                ) : (
                  <p className="text-xs text-text m-0 px-5 py-4">No significant opportunities found.</p>
                )}
              </Section>

              <Section icon={Info} title="Diagnostics" subtitle="Additional information about page performance." count={perf.diagnostics.length}>
                {perf.diagnostics.length > 0 ? (
                  perf.diagnostics.map(a => <AuditRow key={a.id} audit={a} />)
                ) : (
                  <p className="text-xs text-text m-0 px-5 py-4">No additional diagnostics.</p>
                )}
              </Section>

              {resourceSummary && (
                <Section icon={Boxes} title="Resource Breakdown" subtitle="Requests and transfer size by resource type.">
                  <ResourceBreakdown items={resourceSummary} />
                </Section>
              )}

              {thirdParty && (
                <Section icon={Puzzle} title="Third-Party Usage" subtitle="Blocking time and size contributed by third-party code." defaultOpen={false}>
                  <div className="px-5 py-4">
                    <DetailsTable table={thirdParty} />
                  </div>
                </Section>
              )}

              {mainThread && (
                <Section icon={Gauge} title="Main-Thread Work Breakdown" subtitle="Where the browser spends CPU time during load." defaultOpen={false}>
                  <div className="px-5 py-4">
                    <DetailsTable table={mainThread} />
                  </div>
                </Section>
              )}

              {domSize && (
                <Section icon={Boxes} title="DOM Size" subtitle="A large, deep DOM slows down style/layout and memory use." defaultOpen={false}>
                  <div className="px-5 py-4">
                    <DetailsTable table={domSize} />
                  </div>
                </Section>
              )}

              {networkRequests && (
                <Section icon={FileSearch} title="Network Requests" subtitle="Every request made while loading the page." defaultOpen={false} count={networkRequests.rows.length}>
                  <div className="px-5 py-4">
                    <DetailsTable table={networkRequests} />
                  </div>
                </Section>
              )}

              {perf.passed.length > 0 && (
                <Section icon={CircleCheck} title="Passed Audits" subtitle="Checks that already meet best-practice thresholds." defaultOpen={false} count={perf.passed.length}>
                  {perf.passed.map(a => <AuditRow key={a.id} audit={a} />)}
                </Section>
              )}

              {filmstrip && filmstrip.length > 0 && (
                <Section icon={Film} title="Load Filmstrip" subtitle="Visual progress of the page loading over time." defaultOpen={false}>
                  <div className="px-5 py-4 flex gap-2 overflow-x-auto">
                    {filmstrip.map((frame, i) => (
                      <div key={i} className="shrink-0 text-center">
                        <img src={frame.data.startsWith('data:') ? frame.data : `data:image/jpeg;base64,${frame.data}`} alt={`Frame at ${frame.timing}ms`} className="w-24 h-auto rounded-md border border-borderColor" />
                        <span className="text-[10px] text-text block mt-1">{formatMs(frame.timing)}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* Accessibility / Best Practices / SEO tabs */}
          {activeTab !== 'performance' && (
            <CategoryReport report={categoryReports[activeTab]} />
          )}
        </div>
      )}

      {/* Empty state */}
      {!lh && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Gauge size={32} className="text-accent mx-auto mb-2.5 sm:mb-3 sm:size-10" />
          <p className="text-sm text-textHeader font-medium m-0 mb-1">Enter a URL to get started</p>
          <p className="text-xs text-text m-0 max-w-xs">
            Try <code className="font-mono text-accent">web.dev</code> or any public page you want to audit for performance, accessibility, best practices, and SEO.
          </p>
        </div>
      )}
    </div>
  )
}