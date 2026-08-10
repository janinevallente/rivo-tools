import { useState, useCallback, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import { Copy, Check, Plus, X, Shuffle, Download } from 'lucide-react'
import { Select } from 'antd'
import PageHeader from '../components/ui/PageHeader'
import { randomRgb, rgbToHex } from '../utils/colorUtils'

const TYPES = ['linear', 'radial', 'conic']

const RESOLUTIONS = [
  { id: '1280x720', label: '1280 × 720 (HD)', width: 1280, height: 720 },
  { id: '1920x1080', label: '1920 × 1080 (Full HD)', width: 1920, height: 1080 },
  { id: '2560x1440', label: '2560 × 1440 (2K)', width: 2560, height: 1440 },
  { id: '3840x2160', label: '3840 × 2160 (4K)', width: 3840, height: 2160 },
  { id: '1080x1080', label: '1080 × 1080 (Square)', width: 1080, height: 1080 },
  { id: '1080x1920', label: '1080 × 1920 (Portrait)', width: 1080, height: 1920 },
]

const DEFAULT_RESOLUTION = '1920x1080'

let nextId = 3

// Maps a 0-360 angle to the nearest Tailwind `bg-gradient-to-*` direction.
function angleToTailwindDirection(angle) {
  const a = ((angle % 360) + 360) % 360
  const dirs = [
    { deg: 0, cls: 't' },
    { deg: 45, cls: 'tr' },
    { deg: 90, cls: 'r' },
    { deg: 135, cls: 'br' },
    { deg: 180, cls: 'b' },
    { deg: 225, cls: 'bl' },
    { deg: 270, cls: 'l' },
    { deg: 315, cls: 'tl' },
  ]
  let closest = dirs[0]
  let minDiff = 360
  for (const d of dirs) {
    const diff = Math.min(Math.abs(a - d.deg), 360 - Math.abs(a - d.deg))
    if (diff < minDiff) { minDiff = diff; closest = d }
  }
  return closest.cls
}

// Builds a Tailwind class string approximating the gradient.
// Uses from-/via-/to- for the first/middle/last stops (2-3 stops),
// and falls back to an arbitrary bg-[...] value for more stops or radial/conic.
function buildTailwindClasses(type, angle, sortedStops) {
  if (type === 'linear' && sortedStops.length <= 3) {
    const dir = angleToTailwindDirection(angle)
    const classes = [`bg-gradient-to-${dir}`]
    const stopKeys = sortedStops.length === 2 ? ['from', 'to'] : ['from', 'via', 'to']
    sortedStops.forEach((stop, i) => {
      classes.push(`${stopKeys[i]}-[${stop.color}]`)
    })
    return classes.join(' ')
  }

  // Fallback: arbitrary value with the raw CSS gradient
  const stopsCss = sortedStops.map(s => `${s.color}_${s.pos}%`).join(',')
  const value = type === 'linear'
    ? `linear-gradient(${angle}deg,${stopsCss})`
    : type === 'radial'
      ? `radial-gradient(circle,${stopsCss})`
      : `conic-gradient(from_${angle}deg,${stopsCss})`
  return `bg-[${value}]`
}

// Draws the gradient onto an offscreen canvas and returns a PNG data URL.
function renderGradientToPng(type, angle, sortedStops, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  let gradient
  if (type === 'linear') {
    const rad = (angle * Math.PI) / 180
    // CSS gradient angle: 0deg = bottom-to-top, increases clockwise
    const x = Math.sin(rad)
    const y = -Math.cos(rad)
    const cx = width / 2
    const cy = height / 2
    const len = Math.abs(x) * width + Math.abs(y) * height
    const x0 = cx - (x * len) / 2
    const y0 = cy - (y * len) / 2
    const x1 = cx + (x * len) / 2
    const y1 = cy + (y * len) / 2
    gradient = ctx.createLinearGradient(x0, y0, x1, y1)
  } else if (type === 'radial') {
    const r = Math.sqrt(width * width + height * height) / 2
    gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, r)
  } else {
    // conic
    if (ctx.createConicGradient) {
      gradient = ctx.createConicGradient((angle * Math.PI) / 180, width / 2, height / 2)
    } else {
      // Fallback for browsers without conic gradient support
      gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2)
    }
  }

  sortedStops.forEach(s => {
    gradient.addColorStop(Math.min(1, Math.max(0, s.pos / 100)), s.color)
  })

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  return canvas.toDataURL('image/png')
}

export default function GradientGenerator() {
  const [type, setType] = useState('linear')
  const [angle, setAngle] = useState(90)
  const [stops, setStops] = useState([
    { id: 1, color: '#c084fc', pos: 0 },
    { id: 2, color: '#60a5fa', pos: 100 },
  ])
  const [resolution, setResolution] = useState(DEFAULT_RESOLUTION)
  const [copied, setCopied] = useState(null)
  const previewRef = useRef()

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 1500)
  }, [])

  const updateStop = (id, key, value) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, [key]: value } : s))
  }

  const addStop = () => {
    const last = stops[stops.length - 1]
    setStops(prev => [...prev, { id: nextId++, color: '#ffffff', pos: Math.min(100, last.pos + 10) }])
  }

  const removeStop = (id) => {
    if (stops.length <= 2) return
    setStops(prev => prev.filter(s => s.id !== id))
  }

  const randomize = () => {
    setStops(prev => prev.map(s => {
      const c = randomRgb()
      return { ...s, color: rgbToHex(c.r, c.g, c.b) }
    }))
    if (type !== 'radial') setAngle(Math.floor(Math.random() * 360))
  }

  const sortedStops = [...stops].sort((a, b) => a.pos - b.pos)
  const stopsCss = sortedStops.map(s => `${s.color} ${s.pos}%`).join(', ')

  const cssValue = type === 'linear'
    ? `linear-gradient(${angle}deg, ${stopsCss})`
    : type === 'radial'
      ? `radial-gradient(circle, ${stopsCss})`
      : `conic-gradient(from ${angle}deg, ${stopsCss})`

  const fullCss = `background: ${cssValue};`
  const tailwindClasses = buildTailwindClasses(type, angle, sortedStops)

  const downloadPng = () => {
    const res = RESOLUTIONS.find(r => r.id === resolution) || RESOLUTIONS.find(r => r.id === DEFAULT_RESOLUTION)
    const dataUrl = renderGradientToPng(type, angle, sortedStops, res.width, res.height)
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `gradient-${type}-${res.width}x${res.height}.png`
    a.click()
  }

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Gradient Generator</title>
      </Helmet>
      <PageHeader
        title="Gradient Generator"
        description="Create linear, radial, and conic gradients and copy the CSS or Tailwind classes."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-textHeader m-0">Settings</h2>
            <button
              onClick={randomize}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Shuffle size={13} /> Randomize
            </button>
          </div>

          {/* Type selector */}
          <div className="flex gap-2 mb-4">
            {TYPES.map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 capitalize py-2 rounded-xl text-sm font-medium border cursor-pointer transition-colors
                  ${type === t
                    ? 'bg-accentBg text-accent border-accentBorder'
                    : 'bg-backgroundColor text-text border-borderColor hover:border-accent hover:text-accent'
                  }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Angle */}
          {type !== 'radial' && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-accent">
                  {type === 'conic' ? 'Starting Angle' : 'Angle'}
                </label>
                <span className="text-xs text-textHeader font-mono">{angle}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
            </div>
          )}

          {/* Stops */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-accent">Color Stops</label>
              <button
                onClick={addStop}
                className="flex items-center gap-1 text-xs text-accent bg-transparent border-none cursor-pointer hover:opacity-80 transition-opacity"
              >
                <Plus size={13} /> Add Stop
              </button>
            </div>
            {stops.map(stop => (
              <div key={stop.id} className="flex items-center gap-2">
                <input
                  type="color"
                  value={stop.color}
                  onChange={(e) => updateStop(stop.id, 'color', e.target.value)}
                  className="w-9 h-9 rounded-lg border border-borderColor bg-transparent cursor-pointer p-0 shrink-0"
                />
                <input
                  type="text"
                  value={stop.color}
                  onChange={(e) => updateStop(stop.id, 'color', e.target.value)}
                  className="w-24 px-2.5 py-2 rounded-lg bg-backgroundColor border border-borderColor text-xs text-textHeader font-mono focus:outline-none focus:border-accent transition-colors"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={stop.pos}
                  onChange={(e) => updateStop(stop.id, 'pos', Number(e.target.value))}
                  className="flex-1 accent-accent cursor-pointer"
                />
                <span className="text-xs text-text font-mono w-10 text-right shrink-0">{stop.pos}%</span>
                <button
                  onClick={() => removeStop(stop.id)}
                  disabled={stops.length <= 2}
                  className={`p-1 bg-transparent border-none shrink-0 transition-colors
                    ${stops.length <= 2 ? 'text-borderColor cursor-not-allowed' : 'text-text cursor-pointer hover:text-red-500'}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Preview & output */}
        <div className="flex flex-col gap-6">
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-textHeader m-0">Preview</h2>
            </div>
            <div
              ref={previewRef}
              className="w-full aspect-video rounded-xl border border-borderColor mb-4"
              style={{ background: cssValue }}
            />

            {/* Export resolution + download */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Select
                value={resolution}
                onChange={setResolution}
                className="flex-1"
                popupMatchSelectWidth={false}
                options={RESOLUTIONS.map(r => ({ value: r.label, label: r.label }))}
                showSearch
              />
              <button
                onClick={downloadPng}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity shrink-0"
              >
                <Download size={14} /> Save as PNG
              </button>
            </div>
          </div>

          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-textHeader m-0">CSS</h2>
              <button
                onClick={() => copyToClipboard(fullCss)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
              >
                {copied === fullCss ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                Copy
              </button>
            </div>
            <pre className="m-0 p-3.5 rounded-xl bg-backgroundColor border border-borderColor text-[13px] text-textHeader font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {fullCss}
            </pre>
          </div>

          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-textHeader m-0">Tailwind CSS</h2>
              <button
                onClick={() => copyToClipboard(tailwindClasses)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
              >
                {copied === tailwindClasses ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                Copy
              </button>
            </div>
            <pre className="m-0 p-3.5 rounded-xl bg-backgroundColor border border-borderColor text-[13px] text-textHeader font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {tailwindClasses}
            </pre>
            {type !== 'linear' && (
              <p className="text-xs text-text mt-2.5 mb-0">
                Tailwind has no built-in utilities for {type} gradients, so an arbitrary value class is used instead.
              </p>
            )}
            {type === 'linear' && sortedStops.length > 3 && (
              <p className="text-xs text-text mt-2.5 mb-0">
                Tailwind's from-/via-/to- stops support up to 3 colors, so an arbitrary value class is used for this {sortedStops.length}-stop gradient.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}