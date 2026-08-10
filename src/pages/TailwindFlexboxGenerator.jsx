import { useState, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { Select, Switch } from 'antd'
import PageHeader from '../components/ui/PageHeader'

const DIRECTION_OPTS = [
  { value: 'flex-row', label: 'Row' },
  { value: 'flex-row-reverse', label: 'Row Reverse' },
  { value: 'flex-col', label: 'Column' },
  { value: 'flex-col-reverse', label: 'Column Reverse' },
]

const JUSTIFY_OPTS = [
  { value: 'justify-start', label: 'Start' },
  { value: 'justify-end', label: 'End' },
  { value: 'justify-center', label: 'Center' },
  { value: 'justify-between', label: 'Space Between' },
  { value: 'justify-around', label: 'Space Around' },
  { value: 'justify-evenly', label: 'Space Evenly' },
]

const ALIGN_OPTS = [
  { value: 'items-start', label: 'Start' },
  { value: 'items-end', label: 'End' },
  { value: 'items-center', label: 'Center' },
  { value: 'items-stretch', label: 'Stretch' },
  { value: 'items-baseline', label: 'Baseline' },
]

const WRAP_OPTS = [
  { value: 'flex-nowrap', label: 'No Wrap' },
  { value: 'flex-wrap', label: 'Wrap' },
  { value: 'flex-wrap-reverse', label: 'Wrap Reverse' },
]

const GAP_OPTS = [
  { value: 'gap-0', label: '0' },
  { value: 'gap-1', label: '0.25rem' },
  { value: 'gap-2', label: '0.5rem' },
  { value: 'gap-4', label: '1rem' },
  { value: 'gap-6', label: ' 1.5rem' },
  { value: 'gap-8', label: '2rem' },
]

const BP_OPTS = [
  { value: 'sm', label: 'Small (640px+)' },
  { value: 'md', label: 'Medium (768px+)' },
  { value: 'lg', label: 'Large (1024px+)' },
  { value: 'xl', label: 'XL (1280px+)' },
]

const DEFAULT_OPT = { value: '', label: 'Default' }

function ControlRow({ label, description, docsUrl, children }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-0.5">
        <label className="text-sm font-medium text-textHeader">{label}</label>
        {docsUrl && (
          <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="text-text hover:text-accent transition-colors">
            <ExternalLink size={12} />
          </a>
        )}
      </div>
      {description && <p className="text-xs text-text mb-1.5 m-0">{description}</p>}
      {children}
    </div>
  )
}

export default function TailwindFlexboxGenerator() {
  const [direction, setDirection] = useState('flex-row')
  const [justify, setJustify] = useState('justify-start')
  const [align, setAlign] = useState('items-start')
  const [wrap, setWrap] = useState('flex-nowrap')
  const [gap, setGap] = useState('gap-4')
  const [items, setItems] = useState(3)
  const [itemColor, setItemColor] = useState('#3B82F6')
  const [responsive, setResponsive] = useState(false)
  const [bp, setBp] = useState('md')
  const [rDirection, setRDirection] = useState('')
  const [rJustify, setRJustify] = useState('')
  const [rAlign, setRAlign] = useState('')
  const [rWrap, setRWrap] = useState('')
  const [rGap, setRGap] = useState('')
  const [copied, setCopied] = useState(false)

  // Safe fallback calculation for rendering item elements even during keypress modifications
  const activeItems = items === '' ? 1 : items;

  const classes = [
    'flex',
    direction,
    justify,
    align,
    wrap,
    gap,
    responsive && rDirection ? `${bp}:${rDirection}` : '',
    responsive && rJustify ? `${bp}:${rJustify}` : '',
    responsive && rAlign ? `${bp}:${rAlign}` : '',
    responsive && rWrap ? `${bp}:${rWrap}` : '',
    responsive && rGap ? `${bp}:${rGap}` : '',
  ].filter(Boolean).join(' ')

  const copy = useCallback(() => {
    navigator.clipboard.writeText(classes)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [classes])

  const handleItemsChange = (e) => {
    const rawValue = e.target.value;
    
    if (rawValue === '') {
      setItems('');
      return;
    }

    const numericValue = rawValue.replace(/[^0-9]/g, '');
    if (!numericValue) return;

    const parsedNum = Number(numericValue);
    setItems(Math.max(1, Math.min(12, parsedNum)));
  };

  const isCol = direction.includes('col')

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Tailwind Flexbox Generator</title>
      </Helmet>
      <PageHeader
        title="Tailwind Flexbox Generator"
        description="Generate Tailwind CSS classes for your Flexbox layouts."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
          <ControlRow
            label="Flex Direction"
            description="Controls the direction of flex items in the container"
            docsUrl="https://tailwindcss.com/docs/flex-direction"
          >
            <Select value={direction} onChange={setDirection} options={DIRECTION_OPTS} className="rivo-select w-full" popupClassName="rivo-select-dropdown" />
          </ControlRow>

          <ControlRow
            label="Justify Content"
            description="Controls alignment of items along the main axis"
            docsUrl="https://tailwindcss.com/docs/justify-content"
          >
            <Select value={justify} onChange={setJustify} options={JUSTIFY_OPTS} className="rivo-select w-full" popupClassName="rivo-select-dropdown" />
          </ControlRow>

          <ControlRow
            label="Align Items"
            description="Controls alignment of items along the cross axis"
            docsUrl="https://tailwindcss.com/docs/align-items"
          >
            <Select value={align} onChange={setAlign} options={ALIGN_OPTS} className="rivo-select w-full" popupClassName="rivo-select-dropdown" />
          </ControlRow>

          <ControlRow
            label="Flex Wrap"
            description="Controls whether flex items wrap onto multiple lines"
            docsUrl="https://tailwindcss.com/docs/flex-wrap"
          >
            <Select value={wrap} onChange={setWrap} options={WRAP_OPTS} className="rivo-select w-full" popupClassName="rivo-select-dropdown" />
          </ControlRow>

          <ControlRow
            label="Gap"
            description="Controls spacing between flex items"
            docsUrl="https://tailwindcss.com/docs/gap"
          >
            <Select value={gap} onChange={setGap} options={GAP_OPTS} className="rivo-select w-full" popupClassName="rivo-select-dropdown" />
          </ControlRow>

          {/* Number of items without swatches or native spinners */}
          <ControlRow label="Number of Items">
            <div className="flex items-center border border-borderColor rounded-lg bg-backgroundColor overflow-hidden w-32">
              <input
                type="text"
                inputMode="numeric"
                value={items}
                onChange={handleItemsChange}
                className="w-full px-3 py-2 bg-transparent text-sm text-textHeader font-mono focus:outline-none"
              />
            </div>
          </ControlRow>

          {/* Item color */}
          <ControlRow label="Item Color">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-backgroundColor border border-borderColor w-fit">
              <input
                type="color"
                value={itemColor}
                onChange={e => setItemColor(e.target.value)}
                className="w-6 h-6 rounded border-none cursor-pointer p-0 bg-transparent"
              />
              <span className="text-sm font-mono text-textHeader">{itemColor.toUpperCase()}</span>
            </div>
          </ControlRow>

          {/* Responsive Settings */}
          <div className="border-t border-borderColor pt-4">
            <div className="flex items-center gap-3 mb-3">
              <Switch checked={responsive} onChange={setResponsive} size="small" />
              <span className="text-sm font-medium text-textHeader">Enable Responsive Layout</span>
            </div>

            {responsive && (
              <div className="flex flex-col gap-3">
                <ControlRow label="Breakpoint">
                  <Select value={bp} onChange={setBp} options={BP_OPTS} className="rivo-select w-full" popupClassName="rivo-select-dropdown" />
                </ControlRow>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { label: 'Responsive Direction', opts: DIRECTION_OPTS, val: rDirection, set: setRDirection },
                    { label: 'Responsive Justify', opts: JUSTIFY_OPTS, val: rJustify, set: setRJustify },
                    { label: 'Responsive Align', opts: ALIGN_OPTS, val: rAlign, set: setRAlign },
                    { label: 'Responsive Wrap', opts: WRAP_OPTS, val: rWrap, set: setRWrap },
                    { label: 'Responsive Gap', opts: GAP_OPTS, val: rGap, set: setRGap },
                  ].map(({ label, opts, val, set }) => (
                    <ControlRow key={label} label={label}>
                      <Select
                        value={val || undefined}
                        onChange={set}
                        options={[DEFAULT_OPT, ...opts]}
                        placeholder="Default"
                        className="rivo-select w-full"
                        popupClassName="rivo-select-dropdown"
                        allowClear
                      />
                    </ControlRow>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview + Output */}
        <div className="flex flex-col gap-4">
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-textHeader m-0 mb-4">Preview</h2>
            <div
              className="w-full rounded-xl border border-borderColor p-4 min-h-[120px]"
              style={{
                display: 'flex',
                flexDirection: isCol ? (direction.includes('reverse') ? 'column-reverse' : 'column') : (direction.includes('reverse') ? 'row-reverse' : 'row'),
                justifyContent: justify.replace('justify-', '').replace('between', 'space-between').replace('around', 'space-around').replace('evenly', 'space-evenly'),
                alignItems: align.replace('items-', ''),
                flexWrap: wrap === 'flex-wrap' ? 'wrap' : wrap === 'flex-wrap-reverse' ? 'wrap-reverse' : 'nowrap',
                gap: gap.replace('gap-', '') * 4 + 'px',
              }}
            >
              {Array.from({ length: activeItems }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center text-white text-sm font-bold rounded-lg shrink-0"
                  style={{ background: itemColor, width: '56px', height: '56px' }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

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