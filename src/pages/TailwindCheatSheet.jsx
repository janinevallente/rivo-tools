import { useState, useMemo, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Search, Copy, Check } from 'lucide-react'
import { Input } from 'antd'
import PageHeader from '../components/ui/PageHeader'
import { TAILWIND_CHEATSHEET } from '../data/tailwindCheatSheetData'

function CopyButton({ value, copied, onCopy, title }) {
  return (
    <button
      onClick={() => onCopy(value)}
      className="text-text hover:text-accent transition-colors bg-transparent border-none cursor-pointer p-0.5 shrink-0"
      title={title}
    >
      {copied === value ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  )
}

export default function TailwindCheatSheet() {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(null)

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 1500)
  }, [])

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return TAILWIND_CHEATSHEET
    return TAILWIND_CHEATSHEET
      .map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.cls.toLowerCase().includes(q) ||
          item.css.toLowerCase().includes(q) ||
          item.sample.toLowerCase().includes(q) ||
          section.title.toLowerCase().includes(q)
        ),
      }))
      .filter(section => section.items.length > 0)
  }, [query])

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Tailwind CSS Cheat Sheet</title>
      </Helmet>
      <PageHeader
        title="Tailwind CSS Cheat Sheet"
        description="A quick reference for Tailwind CSS utility classes, their CSS equivalents, and sample usage."
      />

      {/* Search */}
      <div className="mb-6">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search classes, CSS, or sections…"
          prefix={<Search size={15} color='#2F49AB' className="me-1 text-text" />}
          allowClear
          className="py-2"
        />
      </div>

      {filteredSections.length === 0 ? (
        <div className="px-4 py-12 rounded-xl bg-backgroundCard border border-borderColor text-center text-text text-sm">
          No classes found for "{query}".
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {filteredSections.map(section => (
            <div key={section.title}>
              <h2 className="text-sm font-semibold text-textHeader m-0 mb-3">{section.title}</h2>

              {/* ===== Desktop / tablet table (md and up) ===== */}
              <div className="hidden md:block rounded-xl border border-borderColor overflow-hidden">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] bg-backgroundColor border-b border-borderColor px-4 py-2.5">
                  <span className="text-[11px] font-semibold tracking-[0.06em] text-text uppercase">Tailwind Class</span>
                  <span className="text-[11px] font-semibold tracking-[0.06em] text-text uppercase">CSS Equivalent</span>
                  <span className="text-[11px] font-semibold tracking-[0.06em] text-text uppercase">Sample Usage</span>
                </div>

                <div className="divide-y divide-borderColor">
                  {section.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] gap-4 px-4 py-3 bg-backgroundCard hover:bg-accentBg transition-colors items-start"
                    >
                      <div className="flex items-start gap-2 min-w-0 pt-0.5">
                        <span className="text-[13px] text-accent font-mono font-medium break-words">{item.cls}</span>
                        <CopyButton value={item.cls} copied={copied} onCopy={copyToClipboard} title="Copy class" />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <span className="text-[12px] text-textHeader font-mono break-words leading-relaxed">{item.css}</span>
                      </div>
                      <div className="min-w-0 flex items-start gap-2 pt-0.5">
                        <span className="text-[12px] text-text font-mono break-words leading-relaxed flex-1">{item.sample}</span>
                        <CopyButton value={item.sample} copied={copied} onCopy={copyToClipboard} title="Copy sample" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ===== Mobile card list (below md) ===== */}
              <div className="md:hidden flex flex-col gap-2.5">
                {section.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-borderColor bg-backgroundCard p-3.5 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] text-accent font-mono font-medium break-words">{item.cls}</span>
                      <CopyButton value={item.cls} copied={copied} onCopy={copyToClipboard} title="Copy class" />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold tracking-[0.06em] text-text uppercase">CSS Equivalent</span>
                      <span className="text-[12px] text-textHeader font-mono break-words leading-relaxed">{item.css}</span>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold tracking-[0.06em] text-text uppercase">Sample Usage</span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] text-text font-mono break-words leading-relaxed">{item.sample}</span>
                        <CopyButton value={item.sample} copied={copied} onCopy={copyToClipboard} title="Copy sample" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}