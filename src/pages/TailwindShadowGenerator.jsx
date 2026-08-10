import { useState, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Copy, Check, Shuffle } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const PRESET_COLORS = [
  '#6b7280','#9ca3af','#d1d5db','#e5e7eb','#f3f4f6','#f9fafb','#f0f0f0','#e0e0e0','#bdbdbd',
  '#818cf8','#a78bfa','#f472b6','#34d399','#fb923c','#facc15','#c084fc','#93c5fd','#fda4af',
  '#e5e7eb','#d1d5db','#6b7280','#374151','#1f2937','#ffffff',
]

const V4_PRESETS = ['shadow-2xs','shadow-xs','shadow-sm','shadow-md','shadow-lg','shadow-xl','shadow-2xl']
const V4_INSET_PRESETS = ['inset-shadow-2xs','inset-shadow-xs','inset-shadow-sm','inset-shadow-none']

function randomColor() {
  const h = Math.floor(Math.random() * 360)
  const s = 40 + Math.floor(Math.random() * 40)
  const l = 40 + Math.floor(Math.random() * 30)
  return `hsl(${h}, ${s}%, ${l}%)`
}

function hslToRgba(h, s, l, a) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const aa = s * Math.min(l, 1 - l)
  const f = n => l - aa * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const r = Math.round(f(0) * 255), g = Math.round(f(8) * 255), b = Math.round(f(4) * 255)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function buildBoxShadow(hOffset, vOffset, blur, spread, color, inset) {
  const h = hOffset === '' ? 0 : hOffset;
  const v = vOffset === '' ? 0 : vOffset;
  const b = blur === '' ? 0 : blur;
  const s = spread === '' ? 0 : spread;
  return `${inset ? 'inset ' : ''}${h}px ${v}px ${b}px ${s}px ${color}`
}

function buildTwV3(hOffset, vOffset, blur, spread, color, inset) {
  const h = hOffset === '' ? 0 : hOffset;
  const v = vOffset === '' ? 0 : vOffset;
  const b = blur === '' ? 0 : blur;
  const s = spread === '' ? 0 : spread;
  const colorClean = color.replace(/ /g, '_')
  return `shadow-[${inset ? 'inset_' : ''}${h}px_${v}px_${b}px_${s}px_${colorClean}]`
}

function buildTwV4(hOffset, vOffset, blur, spread, color, inset) {
  if (inset) {
    const h = hOffset === '' ? 0 : hOffset;
    const v = vOffset === '' ? 0 : vOffset;
    const b = blur === '' ? 0 : blur;
    const s = spread === '' ? 0 : spread;
    const colorClean = color.replace(/ /g, '_')
    return `inset-shadow-[${h}px_${v}px_${b}px_${s}px_${colorClean}]`
  }
  return buildTwV3(hOffset, vOffset, blur, spread, color, false)
}

export default function TailwindShadowGenerator() {
  const [version, setVersion] = useState('v3')
  const [hOffset, setHOffset] = useState(0)
  const [vOffset, setVOffset] = useState(4)
  const [blur, setBlur] = useState(6)
  const [spread, setSpread] = useState(0)
  const [color, setColor] = useState('rgba(0, 0, 0, 0.1)')
  const [inset, setInset] = useState(false)
  const [copied, setCopied] = useState(null)

  const boxShadow = buildBoxShadow(hOffset, vOffset, blur, spread, color, inset)
  const twV3 = buildTwV3(hOffset, vOffset, blur, spread, color, inset)
  const twV4 = buildTwV4(hOffset, vOffset, blur, spread, color, inset)
  const twClass = version === 'v3' ? twV3 : twV4

  const copy = useCallback((text) => {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 1500)
  }, [])

  const randomize = () => {
    setHOffset(Math.floor(Math.random() * 20 - 10))
    setVOffset(Math.floor(Math.random() * 20))
    setBlur(Math.floor(Math.random() * 30))
    setSpread(Math.floor(Math.random() * 10 - 2))
    const h = Math.floor(Math.random() * 360)
    setColor(hslToRgba(h, 60, 50, 0.3 + Math.random() * 0.5))
    setInset(false)
  }

  // Parses rgba strings or standard hex selections cleanly to feed input type="color"
  const getHexColor = (colorString) => {
    if (colorString.startsWith('#')) {
      return colorString.slice(0, 7);
    }
    if (colorString.startsWith('rgba') || colorString.startsWith('rgb')) {
      const matches = colorString.match(/\d+/g);
      if (matches && matches.length >= 3) {
        const r = parseInt(matches[0]).toString(16).padStart(2, '0');
        const g = parseInt(matches[1]).toString(16).padStart(2, '0');
        const b = parseInt(matches[2]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
    return '#000000'; // Fallback
  };

  const SliderRow = ({ label, value, onChange, min = -50, max = 50 }) => {
    const handleTextChange = (e) => {
      const rawValue = e.target.value;
      if (rawValue === '') {
        onChange('');
        return;
      }
      const cleanValue = rawValue.replace(/[^-0-9]/g, '');
      if (cleanValue === '-' || cleanValue === '') {
        onChange(cleanValue);
        return;
      }
      onChange(Number(cleanValue));
    };

    const handleSliderChange = (e) => {
      onChange(Number(e.target.value));
    };

    const safeSliderValue = value === '' || value === '-' ? 0 : Math.max(min, Math.min(max, value));

    return (
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-textHeader">{label}</label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={handleTextChange}
              className="w-16 px-2 py-1 rounded-lg bg-backgroundColor border border-borderColor text-sm text-textHeader font-mono focus:outline-none focus:border-accent text-center"
            />
            <span className="text-xs text-text">px</span>
          </div>
        </div>
        <input
          type="range"
          min={min} 
          max={max}
          value={safeSliderValue}
          onChange={handleSliderChange}
          className="w-full accent-accent cursor-pointer"
        />
      </div>
    );
  };

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Tailwind Shadow Generator</title>
      </Helmet>
      <PageHeader
        title="Tailwind Shadow Generator"
        description="Build custom box-shadow utilities for Tailwind CSS v3 and v4."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
          <SliderRow label="Horizontal Offset" value={hOffset} onChange={setHOffset} min={-50} max={50} />
          <SliderRow label="Vertical Offset" value={vOffset} onChange={setVOffset} min={-50} max={50} />
          <SliderRow label="Blur Radius" value={blur} onChange={setBlur} min={0} max={100} />
          <SliderRow label="Spread Radius" value={spread} onChange={setSpread} min={-50} max={50} />

          {/* Shadow color */}
          <div className="mb-4">
            <label className="text-sm font-medium text-textHeader block mb-1.5">Shadow Color</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-backgroundColor border border-borderColor">
              <input
                type="color"
                value={getHexColor(color)}
                onChange={e => {
                  const hex = e.target.value
                  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
                  setColor(`rgba(${r}, ${g}, ${b}, 0.2)`) // Preserves readability visibility through low default alpha
                }}
                className="w-6 h-6 rounded border-none cursor-pointer p-0 bg-transparent"
              />
              <input
                type="text"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="flex-1 bg-transparent border-none text-sm text-textHeader font-mono focus:outline-none"
              />
            </div>
          </div>

          {/* Color presets */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {PRESET_COLORS.map((c, i) => (
              <button
                key={i}
                onClick={() => setColor(c)}
                style={{ background: c }}
                className="w-7 h-7 rounded-full border-2 border-borderColor cursor-pointer hover:scale-110 transition-transform"
              />
            ))}
          </div>

          {/* Inset toggle */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setInset(!inset)}
              className={`relative w-11 h-6 rounded-full border-none cursor-pointer transition-colors ${inset ? 'bg-accent' : 'bg-borderColor'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${inset ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
            <span className="text-sm text-textHeader">Inset</span>
          </div>

          <button
            onClick={randomize}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold border-none cursor-pointer hover:opacity-90 transition-all"
          >
            <Shuffle size={15} /> Randomize Shadow
          </button>
        </div>

        {/* Preview & output */}
        <div className="flex flex-col gap-4">
          {/* Version toggle */}
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-text uppercase tracking-[0.06em] mb-3">Tailwind Version</p>
            <div className="flex gap-2">
              {['v3', 'v4'].map(v => (
                <button
                  key={v}
                  onClick={() => setVersion(v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border cursor-pointer transition-colors
                    ${version === v ? 'bg-accentBg text-accent border-accentBorder' : 'bg-backgroundColor text-text border-borderColor hover:border-accent hover:text-accent'}`}
                >
                  Tailwind {v}
                </button>
              ))}
            </div>
            {version === 'v4' && inset && (
              <p className="text-xs text-text mt-2.5 mb-0">
                In v4, inset uses <span className="font-mono text-accent">inset-shadow-[...]</span> instead of <span className="font-mono text-accent">shadow-[inset_...]</span>.
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-textHeader m-0 mb-4">Preview</h2>
            <div className="flex items-center justify-center min-h-[120px]">
              <div
                className="w-32 h-24 rounded-xl bg-backgroundColor border border-borderColor"
                style={{ boxShadow }}
              />
            </div>
          </div>

          {/* Tailwind class output */}
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-textHeader m-0">
                Tailwind CSS Class ({version}):
              </h2>
              <button onClick={() => copy(twClass)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80">
                {copied === twClass ? <Check size={13} className="text-green-400" /> : <Copy size={13} />} Copy
              </button>
            </div>
            <pre className="m-0 p-3 rounded-xl bg-backgroundColor border border-borderColor text-[13px] font-mono text-textHeader break-all whitespace-pre-wrap">{twClass}</pre>
          </div>

          {/* v4 presets */}
          {version === 'v4' && (
            <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-textHeader m-0 mb-1">Tailwind v4 Presets</h2>
              <p className="text-xs text-text mb-3">Built-in presets (use <span className="font-mono">var(--shadow-*)</span> in v4).</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {V4_PRESETS.map(p => (
                  <button key={p} onClick={() => copy(p)} className="px-2.5 py-1 rounded-lg text-xs font-mono bg-backgroundColor border border-borderColor text-textHeader cursor-pointer hover:border-accent hover:text-accent transition-colors">
                    {p}
                  </button>
                ))}
              </div>
              <p className="text-xs text-text mb-2">Inset presets</p>
              <div className="flex flex-wrap gap-2">
                {V4_INSET_PRESETS.map(p => (
                  <button key={p} onClick={() => copy(p)} className="px-2.5 py-1 rounded-lg text-xs font-mono bg-backgroundColor border border-borderColor text-textHeader cursor-pointer hover:border-accent hover:text-accent transition-colors">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CSS output */}
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-textHeader m-0">CSS Class:</h2>
              <button onClick={() => copy(`box-shadow: ${boxShadow};`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80">
                {copied === `box-shadow: ${boxShadow};` ? <Check size={13} className="text-green-400" /> : <Copy size={13} />} Copy
              </button>
            </div>
            <pre className="m-0 p-3 rounded-xl bg-backgroundColor border border-borderColor text-[13px] font-mono text-textHeader break-all whitespace-pre-wrap">{`box-shadow: ${boxShadow};`}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}