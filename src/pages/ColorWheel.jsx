import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { 
  Copy,
  Check,
  Shuffle,
  SquareArrowOutUpRight,
  X 
} from 'lucide-react'
import { Select } from 'antd'
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  rgbToOklch,
  oklchToRgb,
  getHarmony,
  randomRgb,
  clamp,
} from '../utils/colorUtils'
import PageHeader from '../components/ui/PageHeader'

const WHEEL_SIZE = 260

const HARMONIES = [
  { id: 'analogous', label: 'Analogous' },
  { id: 'complementary', label: 'Complementary' },
  { id: 'split-complementary', label: 'Split Complementary' },
  { id: 'triadic', label: 'Triadic' },
  { id: 'tetradic', label: 'Tetradic' },
  { id: 'square', label: 'Square' },
]

const VALUE_FORMATS = [
  { id: 'Hex', placeholder: '#EA583F' },
  { id: 'RGB', placeholder: '234, 88, 63' },
  { id: 'HSL', placeholder: '9, 80%, 58%' },
  { id: 'OKLCH', placeholder: '0.65 0.19 32' },
]

const EXPORT_TARGETS = [
  { id: 'tailwind-v4', label: 'Tailwind v4', desc: 'Tailwind CSS variables' },
  { id: 'tailwind-v3', label: 'Tailwind v3', desc: 'Tailwind config object' },
  { id: 'figma', label: 'Figma', desc: 'Figma color object' },
  { id: 'css-prefixes', label: 'CSS prefixes', desc: '#, rgb(), hsl(), oklch()' },
  { id: 'just-codes', label: 'Just the codes', desc: 'Hex, rgb, hsl, oklch' },
]

// Helpers

function formatValue(rgb, type) {
  const r = clamp(rgb.r, 0, 255), g = clamp(rgb.g, 0, 255), b = clamp(rgb.b, 0, 255)
  switch (type) {
    case 'Hex': return rgbToHex(r, g, b).toUpperCase()
    case 'RGB': return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
    case 'HSL': {
      const { h, s, l } = rgbToHsl(r, g, b)
      return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`
    }
    case 'OKLCH': {
      const { l, c, h } = rgbToOklch(r, g, b)
      return `oklch(${l.toFixed(2)} ${c.toFixed(2)} ${h.toFixed(1)})`
    }
    default: return ''
  }
}

function parseValue(format, text) {
  const cleaned = text.replace(/[a-z%()]/gi, '').trim()
  const nums = cleaned.split(/[\s,]+/).filter(Boolean).map(Number)
  switch (format) {
    case 'Hex':
      return hexToRgb(text)
    case 'RGB':
      if (nums.length !== 3 || nums.some(Number.isNaN)) return null
      return { r: clamp(nums[0], 0, 255), g: clamp(nums[1], 0, 255), b: clamp(nums[2], 0, 255) }
    case 'HSL':
      if (nums.length !== 3 || nums.some(Number.isNaN)) return null
      return hslToRgb(nums[0], nums[1], nums[2])
    case 'OKLCH':
      if (nums.length !== 3 || nums.some(Number.isNaN)) return null
      return oklchToRgb(nums[0], nums[1], nums[2])
    default:
      return null
  }
}

function buildExportCode(colors, valueType, target, prefix) {
  const key = prefix.trim() || 'color'
  const values = colors.map(c => formatValue(c, valueType))
  switch (target) {
    case 'tailwind-v4':
      return values.map((v, i) => `--${key}-${i + 1}: ${v};`).join('\n')
    case 'tailwind-v3':
    case 'figma':
      return `"${key}": {\n${values.map((v, i) => `  ${i + 1}: "${v}"`).join(',\n')}\n}`
    case 'css-prefixes':
      return values.map(v => `${v};`).join('\n')
    case 'just-codes':
    default:
      return values.join('\n')
  }
}

function toHexLabel(rgb) {
  return rgbToHex(rgb.r, rgb.g, rgb.b).slice(1).toUpperCase()
}

export default function ColorWheel() {
  const [rgb, setRgb] = useState({ r: 234, g: 88, b: 63 }) // #EA583F
  const [harmonyType, setHarmonyType] = useState('analogous')
  const [inputFormat, setInputFormat] = useState('Hex')
  const [colorInput, setColorInput] = useState(formatValue({ r: 234, g: 88, b: 63 }, 'Hex'))
  const [copied, setCopied] = useState(null)
  const [exportColors, setExportColors] = useState(null) // null = closed, else array of {r,g,b}
  const [exportValueType, setExportValueType] = useState('Hex')
  const [exportTarget, setExportTarget] = useState('tailwind-v4')
  const [exportPrefix, setExportPrefix] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)

  const canvasRef = useRef(null)
  const wheelRef = useRef(null)
  const draggingRef = useRef(false)

  // Draw the static hue/saturation wheel once
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const size = WHEEL_SIZE
    const radius = size / 2
    const imageData = ctx.createImageData(size, size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - radius + 0.5
        const dy = y - radius + 0.5
        const dist = Math.sqrt(dx * dx + dy * dy)
        const idx = (y * size + x) * 4
        if (dist <= radius) {
          let angle = Math.atan2(dy, dx) * (180 / Math.PI)
          if (angle < 0) angle += 360
          const sat = Math.min(100, (dist / radius) * 100)
          const { r, g, b } = hsvToRgb(angle, sat, 100)
          imageData.data[idx] = r
          imageData.data[idx + 1] = g
          imageData.data[idx + 2] = b
          imageData.data[idx + 3] = 255
        } else {
          imageData.data[idx + 3] = 0
        }
      }
    }
    ctx.putImageData(imageData, 0, 0)
  }, [])

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 1500)
  }, [])

  // Apply a new color from an external action (wheel, random, harmony, shade strip)
  const applyColor = useCallback((newRgb) => {
    const clamped = {
      r: clamp(newRgb.r, 0, 255),
      g: clamp(newRgb.g, 0, 255),
      b: clamp(newRgb.b, 0, 255),
    }
    setRgb(clamped)
    setColorInput(formatValue(clamped, inputFormat))
  }, [inputFormat])

  const updateFromPointer = useCallback((clientX, clientY) => {
    const el = wheelRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = clientX - cx
    let dy = clientY - cy
    let dist = Math.sqrt(dx * dx + dy * dy)
    const maxR = rect.width / 2
    if (dist > maxR) {
      dx = (dx / dist) * maxR
      dy = (dy / dist) * maxR
      dist = maxR
    }
    let angle = Math.atan2(dy, dx) * (180 / Math.PI)
    if (angle < 0) angle += 360
    const sat = (dist / maxR) * 100
    const currentHsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
    const value = currentHsv.v > 0 ? currentHsv.v : 100
    applyColor(hsvToRgb(angle, sat, value))
  }, [rgb, applyColor])

  const handlePointerDown = (e) => {
    draggingRef.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    updateFromPointer(e.clientX, e.clientY)
  }
  const handlePointerMove = (e) => {
    if (!draggingRef.current) return
    updateFromPointer(e.clientX, e.clientY)
  }
  const handlePointerUp = (e) => {
    draggingRef.current = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  // Marker position (based on hue/saturation, ignoring value)
  const markerPos = useMemo(() => {
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
    const r = (hsv.s / 100) * (WHEEL_SIZE / 2)
    const angle = (hsv.h * Math.PI) / 180
    return {
      x: WHEEL_SIZE / 2 + r * Math.cos(angle),
      y: WHEEL_SIZE / 2 + r * Math.sin(angle),
    }
  }, [rgb])

  const harmonyColors = useMemo(
    () => getHarmony(rgb.r, rgb.g, rgb.b, harmonyType),
    [rgb, harmonyType]
  )

  // Small dots plotted on the wheel ring for the active harmony's hues
  const ringMarkers = useMemo(() => {
    const seen = new Set()
    return harmonyColors
      .map((c) => {
        const hsv = rgbToHsv(c.r, c.g, c.b)
        const key = Math.round(hsv.h)
        if (seen.has(key)) return null
        seen.add(key)
        const angle = (hsv.h * Math.PI) / 180
        const radius = WHEEL_SIZE / 2
        return {
          color: c,
          x: WHEEL_SIZE / 2 + radius * Math.cos(angle),
          y: WHEEL_SIZE / 2 + radius * Math.sin(angle),
        }
      })
      .filter(Boolean)
  }, [harmonyColors])

  // Shade strip (tints to shades of the current hue/saturation)
  const { h: baseHue, s: baseSat, l: baseLight } = useMemo(() => rgbToHsl(rgb.r, rgb.g, rgb.b), [rgb])
  const shadeStops = useMemo(() => {
    const stops = []
    for (let l = 95; l >= 5; l -= 10) {
      const c = hslToRgb(baseHue, baseSat, l)
      stops.push(`${rgbToHex(c.r, c.g, c.b)} ${((95 - l) / 90) * 100}%`)
    }
    return stops.join(', ')
  }, [baseHue, baseSat])

  const handleShadeClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    const l = 95 - frac * 90
    applyColor(hslToRgb(baseHue, baseSat, l))
  }

  // Input handling
  const handleColorInputChange = (text) => {
    setColorInput(text)
    const parsed = parseValue(inputFormat, text)
    if (parsed) {
      setRgb({ r: clamp(parsed.r, 0, 255), g: clamp(parsed.g, 0, 255), b: clamp(parsed.b, 0, 255) })
    }
  }

  const handleFormatChange = (fmt) => {
    setInputFormat(fmt)
    setColorInput(formatValue(rgb, fmt))
  }

  const handleRandom = () => {
    applyColor(randomRgb())
  }

  //Export Modal Functions

  const openExport = (colors) => {
    setExportColors(colors)
    setExportPrefix('')
    setCodeCopied(false)
  }

  const closeExport = () => setExportColors(null)

  const exportCode = useMemo(() => {
    if (!exportColors) return ''
    return buildExportCode(exportColors, exportValueType, exportTarget, exportPrefix)
  }, [exportColors, exportValueType, exportTarget, exportPrefix])

  const copyExportCode = () => {
    navigator.clipboard.writeText(exportCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 1500)
  }

  const currentFormatMeta = VALUE_FORMATS.find(f => f.id === inputFormat)

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Color Wheel</title>
      </Helmet>
      <PageHeader
        title="Color Wheel"
        description="Create perfect color palettes with our color wheel. Start with a base color and find complementary, analogous, triadic and other schemes to elevate your designs."
      />

      {/* Top bar: current color summary */}
      <div className="bg-backgroundCard border border-borderColor rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6">
        {/* lg+: everything in one row */}
        <div className="hidden lg:flex items-center gap-6">
          <div
            className="w-10 h-10 rounded-xl border border-borderColor shrink-0"
            style={{ background: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }}
          />
 
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 flex-1 min-w-0">
            {VALUE_FORMATS.map(({ id }) => {
              const val = formatValue(rgb, id)
              return (
                <button
                  key={id}
                  onClick={() => copyToClipboard(val)}
                  className="flex flex-col items-start gap-0.5 bg-transparent border-none cursor-pointer text-left p-0 group min-w-0"
                  title="Copy"
                >
                  <span className="text-[10px] font-semibold text-accent uppercase">{id}</span>
                  <span className="text-xs text-textHeader font-mono flex items-center gap-1.5 group-hover:text-accent transition-colors truncate">
                    {val}
                    {copied === val ? <Check size={11} className="text-green-400 shrink-0" /> : <Copy size={11} className="opacity-60 shrink-0" />}
                  </span>
                </button>
              )
            })}
          </div>
 
          {/* Shade strip */}
          <div className="flex-1 max-w-[260px]">
            <div
              onClick={handleShadeClick}
              className="relative h-9 rounded-lg border border-borderColor cursor-pointer overflow-hidden"
              style={{ background: `linear-gradient(to right, ${shadeStops})` }}
              title="Click to pick a shade"
            >
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
                style={{
                  left: `${((95 - baseLight) / 90) * 100}%`,
                  background: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
                }}
              />
            </div>
          </div>
 
          <button
            onClick={() => openExport(harmonyColors)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-accent text-white border-none cursor-pointer hover:opacity-90 transition-all shrink-0"
          >
            <SquareArrowOutUpRight size={14} /> Export Colors
          </button>
        </div>
 
        {/* below lg: preview + shade strip in a row, export button below */}
        <div className="flex lg:hidden flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-borderColor shrink-0"
              style={{ background: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }}
            />
 
            <div className="flex-1 min-w-0">
              <div
                onClick={handleShadeClick}
                className="relative h-8 sm:h-9 rounded-lg border border-borderColor cursor-pointer overflow-hidden"
                style={{ background: `linear-gradient(to right, ${shadeStops})` }}
                title="Click to pick a shade"
              >
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
                  style={{
                    left: `${((95 - baseLight) / 90) * 100}%`,
                    background: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
                  }}
                />
              </div>
            </div>
          </div>
 
          <button
            onClick={() => openExport(harmonyColors)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-accent text-white border-none cursor-pointer hover:opacity-90 transition-all w-full sm:w-auto sm:self-center"
          >
            <SquareArrowOutUpRight size={14} /> Export Colors
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: wheel + input */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 flex flex-col items-center">
          <div
            ref={wheelRef}
            className="relative cursor-crosshair touch-none select-none"
            style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <canvas
              ref={canvasRef}
              width={WHEEL_SIZE}
              height={WHEEL_SIZE}
              className="rounded-full block"
            />
            {/* Harmony ring markers */}
            {ringMarkers.map((m, i) => (
              <div
                key={i}
                className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow pointer-events-none"
                style={{
                  left: m.x,
                  top: m.y,
                  transform: 'translate(-50%, -50%)',
                  background: `rgb(${m.color.r}, ${m.color.g}, ${m.color.b})`,
                }}
              />
            ))}
            {/* Main marker */}
            <div
              className="absolute w-6 h-6 rounded-full border-[3px] border-white shadow-lg pointer-events-none"
              style={{
                left: markerPos.x,
                top: markerPos.y,
                transform: 'translate(-50%, -50%)',
                background: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
              }}
            />
          </div>

          {/* Hex / format input */}
          <div className="flex items-center gap-2 mt-5 w-full max-w-sm">
            <div
              className="w-9 h-9 rounded-lg border border-borderColor shrink-0"
              style={{ background: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }}
            />
            <input
              type="text"
              value={colorInput}
              onChange={(e) => handleColorInputChange(e.target.value)}
              placeholder={currentFormatMeta?.placeholder}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-backgroundColor border border-borderColor text-sm text-textHeader font-mono focus:outline-none focus:border-accent transition-colors"
            />
            <button
              onClick={() => copyToClipboard(colorInput)}
              className="p-2 rounded-lg border border-borderColor bg-backgroundColor text-text hover:text-accent hover:border-accent transition-colors cursor-pointer shrink-0"
              title="Copy"
            >
              {copied === colorInput ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
            </button>
            <Select
              value={inputFormat}
              onChange={handleFormatChange}
              popupMatchSelectWidth={false}
              className="shrink-0 w-[88px]"
              options={VALUE_FORMATS.map(f => ({ value: f.id, label: f.id }))}
            />
          </div>

          <button
            onClick={handleRandom}
            className="flex items-center gap-1.5 mt-4 px-3.5 py-2 rounded-lg text-sm font-medium bg-accentBg border border-accentBorder text-accent cursor-pointer hover:opacity-80 transition-opacity"
          >
            <Shuffle size={14} /> Random Color
          </button>
        </div>

        {/* Right: harmony preview */}
        <div className="flex flex-col">
          <Select
            value={harmonyType}
            onChange={setHarmonyType}
            className="w-full mb-3"
            size="large"
            options={HARMONIES.map(h => ({ value: h.id, label: h.label }))}
            showSearch
          />

          <div className="rounded-2xl border border-borderColor overflow-hidden flex-1 flex flex-col min-h-[260px]">
            {harmonyColors.map((c, i) => {
              const hex = toHexLabel(c)
              return (
                <button
                  key={i}
                  onClick={() => copyToClipboard(`#${hex}`)}
                  className="flex-1 flex items-center justify-center text-sm font-mono font-medium border-none cursor-pointer transition-opacity hover:opacity-90"
                  style={{ background: `rgb(${c.r}, ${c.g}, ${c.b})`, color: rgbToHsl(c.r, c.g, c.b).l > 60 ? '#1a1a1a' : '#ffffff' }}
                  title="Copy hex"
                >
                  {copied === `#${hex}` ? <Check size={14} /> : hex}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Color Harmonies */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-textHeader m-0 mb-4">Color Harmonies</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {HARMONIES.map(h => {
            const colors = getHarmony(rgb.r, rgb.g, rgb.b, h.id)
            return (
              <div key={h.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-textHeader">{h.label}</span>
                  <button
                    onClick={() => openExport(colors)}
                    className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded-lg text-[11px] sm:text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <SquareArrowOutUpRight size={12} /> Export
                  </button>
                </div>
                <div className="flex h-12 rounded-xl overflow-hidden border border-borderColor">
                  {colors.map((c, i) => (
                    <div
                      key={i}
                      className="flex-1"
                      style={{ background: `rgb(${c.r}, ${c.g}, ${c.b})` }}
                      title={`#${toHexLabel(c)}`}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Export modal */}
      {exportColors && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeExport}
        >
          <div
            className="bg-backgroundCard border border-borderColor rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-borderColor">
              <h3 className="text-base font-semibold text-textHeader m-0">Export color codes</h3>
              <button
                onClick={closeExport}
                className="p-1 rounded-lg bg-transparent border-none text-text hover:text-accent cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col md:flex-row">
              {/* Sidebar */}
              <div className="md:w-[200px] shrink-0 p-2 md:border-r border-borderColor flex md:flex-col gap-1 overflow-x-auto">
                {EXPORT_TARGETS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setExportTarget(t.id)}
                    className={`text-left px-3 py-2 rounded-xl border-none cursor-pointer transition-colors shrink-0 whitespace-nowrap
                      ${exportTarget === t.id
                        ? 'bg-accentBg text-accent'
                        : 'bg-transparent text-textHeader hover:bg-accentBg hover:text-accent'
                      }`}
                  >
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-[11px] text-text">{t.desc}</div>
                  </button>
                ))}
              </div>

              {/* Main */}
              <div className="flex-1 p-4 flex flex-col gap-4 min-w-0">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex gap-1.5 flex-wrap">
                    {VALUE_FORMATS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setExportValueType(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors
                          ${exportValueType === f.id
                            ? 'bg-accentBg text-accent border-accentBorder'
                            : 'bg-backgroundColor text-text border-borderColor hover:border-accent hover:text-accent'
                          }`}
                      >
                        {f.id}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={exportPrefix}
                    onChange={(e) => setExportPrefix(e.target.value)}
                    placeholder="prefix"
                    className="w-28 px-2.5 py-1.5 rounded-lg bg-backgroundColor border border-borderColor text-xs text-textHeader font-mono focus:outline-none focus:border-accent transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Swatches */}
                  <div className="rounded-xl border border-borderColor overflow-hidden flex flex-col">
                    {exportColors.map((c, i) => {
                      const val = formatValue(c, exportValueType)
                      return (
                        <button
                          key={i}
                          onClick={() => copyToClipboard(val)}
                          className="flex-1 min-h-[44px] flex items-center justify-center gap-2 text-xs font-mono font-medium border-none cursor-pointer transition-opacity hover:opacity-90"
                          style={{ background: `rgb(${c.r}, ${c.g}, ${c.b})`, color: rgbToHsl(c.r, c.g, c.b).l > 60 ? '#1a1a1a' : '#ffffff' }}
                        >
                          {val}
                          {copied === val ? <Check size={13} /> : <Copy size={13} className="opacity-70" />}
                        </button>
                      )
                    })}
                  </div>

                  {/* Code */}
                  <div className="rounded-xl bg-backgroundColor border border-borderColor p-3 flex flex-col">
                    <pre className="m-0 mb-3 flex-1 text-[12px] text-textHeader font-mono whitespace-pre-wrap break-all">
                      {exportCode}
                    </pre>
                    <button
                      onClick={copyExportCode}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-accent text-white border-none cursor-pointer hover:opacity-90 transition-all"
                    >
                      {codeCopied ? <Check size={13} /> : <Copy size={13} />}
                      Copy codes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}