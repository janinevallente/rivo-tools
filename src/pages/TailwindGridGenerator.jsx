import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { Select } from 'antd'

const FLOW_OPTIONS = [
  { value: 'row', label: 'Row' },
  { value: 'col', label: 'Column' },
  { value: 'row-dense', label: 'Row Dense' },
  { value: 'col-dense', label: 'Column Dense' },
]

const JUSTIFY_OPTIONS = [
  { value: 'start', label: 'Start' },
  { value: 'end', label: 'End' },
  { value: 'center', label: 'Center' },
  { value: 'between', label: 'Space Between' },
  { value: 'around', label: 'Space Around' },
  { value: 'evenly', label: 'Space Evenly' },
  { value: 'stretch', label: 'Stretch' },
]

const ALIGN_OPTIONS = [
  { value: 'start', label: 'Start' },
  { value: 'end', label: 'End' },
  { value: 'center', label: 'Center' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'baseline', label: 'Baseline' },
]

// Updated NumberInput: Swatches stripped, native spinners hidden via text enforcement
function NumberInput({ label, value, onChange, min = 1, max = 12 }) {
  const handleInputChange = (e) => {
    const rawValue = e.target.value;

    // Allow empty string so users can backspace and clear the input temporarily while typing
    if (rawValue === '') {
      onChange('');
      return;
    }

    // Strip non-numeric characters via regex matching
    const numericValue = rawValue.replace(/[^0-9]/g, '');
    if (!numericValue) return;

    // Enforce min/max boundaries
    const parsedNum = Number(numericValue);
    const boundedNum = Math.max(min, Math.min(max, parsedNum));
    
    onChange(boundedNum);
  };

  return (
    <div>
      <label className="text-xs font-semibold text-text uppercase tracking-[0.06em] block mb-1.5">
        {label}
      </label>
      <div className="flex items-center border border-borderColor rounded-lg bg-backgroundColor overflow-hidden">
        <input
          type="text"
          inputMode="numeric" // Triggers numeric keyboard on mobile devices
          value={value}
          onChange={handleInputChange}
          className="w-full px-3 py-2 bg-transparent text-sm text-textHeader font-mono focus:outline-none"
        />
      </div>
    </div>
  );
}

export default function TailwindGridGenerator() {
  // Coerce any temporary empty input state back to minimum boundary for calculations
  const [cols, setCols] = useState(2)
  const [rows, setRows] = useState(3)
  const [gapX, setGapX] = useState(4)
  const [gapY, setGapY] = useState(4)
  const [smGap, setSmGap] = useState(2)
  const [mdGap, setMdGap] = useState(4)
  const [lgGap, setLgGap] = useState(6)
  const [xlGap, setXlGap] = useState(8)
  const [flow, setFlow] = useState('row')
  const [justify, setJustify] = useState('start')
  const [align, setAlign] = useState('stretch')
  const [custom, setCustom] = useState('')
  const [copied, setCopied] = useState(false)

  // Compute values safely even if state falls to empty string momentarily
  const activeCols = cols === '' ? 1 : cols;
  const activeRows = rows === '' ? 1 : rows;
  const activeGapX = gapX === '' ? 0 : gapX;
  const activeGapY = gapY === '' ? 0 : gapY;

  const classes = [
    'grid',
    `grid-cols-${activeCols}`,
    `grid-rows-${activeRows}`,
    activeGapX === activeGapY ? `gap-${activeGapX}` : `gap-x-${activeGapX} gap-y-${activeGapY}`,
    smGap !== '' ? `sm:gap-${smGap}` : '',
    mdGap !== '' ? `md:gap-${mdGap}` : '',
    lgGap !== '' ? `lg:gap-${lgGap}` : '',
    xlGap !== '' ? `xl:gap-${xlGap}` : '',
    flow !== 'row' ? `grid-flow-${flow}` : '',
    justify !== 'start' ? `justify-${justify}` : '',
    align !== 'stretch' ? `items-${align}` : '',
    custom.trim(),
  ].filter(Boolean).join(' ')

  const copy = useCallback(() => {
    navigator.clipboard.writeText(classes)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [classes])

  const items = Array.from({ length: activeCols * activeRows })

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <PageHeader
        title="Tailwind Grid Generator"
        description="Visually build CSS grid layouts and copy the Tailwind CSS classes."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 flex flex-col gap-5">
          {/* Columns & Rows */}
          <div className="grid grid-cols-2 gap-4">
            <NumberInput label="Columns" value={cols} onChange={setCols} min={1} max={12} />
            <NumberInput label="Rows" value={rows} onChange={setRows} min={1} max={12} />
          </div>

          {/* Gap Controls */}
          <div>
            <h2 className="text-sm font-semibold text-textHeader m-0 mb-3">Gap Controls</h2>
            <div className="grid grid-cols-2 gap-4">
              <NumberInput label="Gap X" value={gapX} onChange={setGapX} min={0} max={24} />
              <NumberInput label="Gap Y" value={gapY} onChange={setGapY} min={0} max={24} />
            </div>
          </div>

          {/* Responsive Gap */}
          <div>
            <h2 className="text-sm font-semibold text-textHeader m-0 mb-3">Responsive Gap</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <NumberInput label="SM" value={smGap} onChange={setSmGap} min={0} max={24} />
              <NumberInput label="MD" value={mdGap} onChange={setMdGap} min={0} max={24} />
              <NumberInput label="LG" value={lgGap} onChange={setLgGap} min={0} max={24} />
              <NumberInput label="XL" value={xlGap} onChange={setXlGap} min={0} max={24} />
            </div>
          </div>

          {/* Flow Direction */}
          <div>
            <label className="text-xs font-semibold text-text uppercase tracking-[0.06em] block mb-1.5">Flow Direction</label>
            <Select
              value={flow}
              onChange={setFlow}
              options={FLOW_OPTIONS}
              className="rivo-select w-full"
              popupClassName="rivo-select-dropdown"
            />
          </div>

          {/* Justify & Align */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-text uppercase tracking-[0.06em] block mb-1.5">Justify Content</label>
              <Select
                value={justify}
                onChange={setJustify}
                options={JUSTIFY_OPTIONS}
                className="rivo-select w-full"
                popupClassName="rivo-select-dropdown"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text uppercase tracking-[0.06em] block mb-1.5">Align Items</label>
              <Select
                value={align}
                onChange={setAlign}
                options={ALIGN_OPTIONS}
                className="rivo-select w-full"
                popupClassName="rivo-select-dropdown"
              />
            </div>
          </div>

          {/* Custom classes */}
          <div>
            <label className="text-xs font-semibold text-text uppercase tracking-[0.06em] block mb-1.5">Custom Classes</label>
            <input
              type="text"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="Add custom Tailwind classes"
              className="w-full px-3 py-2.5 rounded-lg bg-backgroundColor border border-borderColor text-sm text-textHeader font-mono focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        {/* Preview & output */}
        <div className="flex flex-col gap-4">
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-textHeader m-0 mb-4">Preview</h2>
            <div
              className="w-full rounded-xl border border-borderColor p-3 min-h-[220px]"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${activeCols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${activeRows}, minmax(0, 1fr))`,
                gap: `${activeGapY * 4}px ${activeGapX * 4}px`,
              }}
            >
              {items.map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center text-white text-sm font-bold rounded-lg shrink-0"
                  style={{ background: '#3B82F6'}}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Generated classes */}
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-textHeader m-0 mb-3">Generated Classes</h2>
            <pre className="m-0 p-3.5 rounded-xl bg-backgroundColor border border-borderColor text-[13px] text-textHeader font-mono whitespace-pre-wrap break-all mb-3">{classes}</pre>
            <button
              onClick={copy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold border-none cursor-pointer hover:opacity-90 transition-all"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied!' : 'Copy Classes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}