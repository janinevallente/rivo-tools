import { useState, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet-async';
import { Pipette, Upload, Copy, Check, X, Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function rgbToOklch(r, g, b) {
  // sRGB -> linear
  const lin = (c) => {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const lr = lin(r), lg = lin(g), lb = lin(b)
  // linear sRGB -> OKLab
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s)
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
  const bVal = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  const C = Math.sqrt(a * a + bVal * bVal)
  let H = Math.atan2(bVal, a) * (180 / Math.PI)
  if (H < 0) H += 360
  return [Math.round(L * 100) / 100, Math.round(C * 1000) / 1000, Math.round(H * 10) / 10]
}

function hexFromRgb(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function getFormats(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b)
  const [lch_l, lch_c, lch_h] = rgbToOklch(r, g, b)
  return {
    HEX: hexFromRgb(r, g, b),
    RGB: `rgb(${r}, ${g}, ${b})`,
    HSL: `hsl(${h}, ${s}%, ${l}%)`,
    OKLCH: `oklch(${lch_l} ${lch_c} ${lch_h})`,
  }
}

function ColorRow({ label, value, onCopy, copied }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-backgroundColor border border-borderColor group">
      <span className="text-[11px] font-semibold text-accent min-w-[52px]">{label}</span>
      <span className="text-[13px] text-textHeader font-mono flex-1 truncate">{value}</span>
      <button
        onClick={() => onCopy(value)}
        className="text-text hover:text-accent transition-colors bg-transparent border-none cursor-pointer p-1 shrink-0"
        title="Copy"
      >
        {copied === value ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
      </button>
    </div>
  )
}

export default function PixelPicker() {
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [picked, setPicked] = useState(null)   // { r, g, b }
  const [history, setHistory] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [copied, setCopied] = useState(null)

  const inputRef = useRef()
  const canvasRef = useRef()
  const imgRef = useRef()

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
    setPicked(null)
  }

  const handleFileChange = (e) => loadFile(e.target.files[0])
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0])
  }, [])
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  const pickFromImage = (e) => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return

    const rect = img.getBoundingClientRect()
    const scaleX = img.naturalWidth / rect.width
    const scaleY = img.naturalHeight / rect.height
    const x = Math.floor((e.clientX - rect.left) * scaleX)
    const y = Math.floor((e.clientY - rect.top) * scaleY)

    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const [r, g, b] = ctx.getImageData(x, y, 1, 1).data

    const color = { r, g, b }
    setPicked(color)
    setHistory(prev => [color, ...prev].slice(0, 16))
  }

  const copyToClipboard = (value) => {
    navigator.clipboard.writeText(value)
    setCopied(value)
    setTimeout(() => setCopied(null), 1800)
  }

  const reset = () => {
    setImage(null); setPreview(null); setPicked(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const formats = picked ? getFormats(picked.r, picked.g, picked.b) : null
  const pickedHex = picked ? hexFromRgb(picked.r, picked.g, picked.b) : null

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Pixel Picker</title>
      </Helmet>
      <PageHeader
        title="Pixel Picker"
        description="Upload an image and click any pixel to pick its color. Get HEX, RGB, HSL, and OKLCH values instantly."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: upload + color output */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-accentBg border border-accentBorder text-accent cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Upload size={15} /> Upload Image
            </button>
            {image && (
              <button
                onClick={reset}
                 className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-errorBg text-error border border-errorBorder cursor-pointer hover:opacity-80 transition-opacity ml-auto"
              >
                <Trash2 size={14} /> Clear
              </button>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Image canvas */}
          {!preview ? (
            <div className="bg-backgroundCard border border-borderColor rounded-2xl overflow-hidden flex-1">
              <div
                onClick={() => inputRef.current?.click()}
                onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                className={`px-6 py-16 text-center cursor-pointer transition-all h-full flex flex-col items-center justify-center
                  ${dragOver ? 'bg-accentBg' : 'hover:bg-accentBg'}`}
              >
                <Pipette size={40} className="text-accent mx-auto mb-3" />
                <p className="font-medium text-sm text-textHeader mb-1">Drop an image or click to upload</p>
                <p className="text-text text-xs">Then click any pixel to pick its color</p>
              </div>
            </div>
          ) : (
            <div className="bg-backgroundCard border border-borderColor rounded-2xl overflow-hidden flex-1 flex flex-col">
              <div className="relative flex-1 flex items-center justify-center">
                <img
                  ref={imgRef}
                  src={preview}
                  alt="Uploaded"
                  onClick={pickFromImage}
                  className="w-full object-contain max-h-[480px] block cursor-crosshair"
                  style={{ imageRendering: 'pixelated' }}
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <p className="text-[11px] text-text text-center py-2 border-t border-borderColor shrink-0">
                Click anywhere on the image to pick a color
              </p>
            </div>
          )}

          {/* Color output */}
          {formats && (
            <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-14 h-14 rounded-xl border border-borderColor shrink-0"
                  style={{ background: pickedHex }}
                />
                <div>
                  <p className="text-textHeader font-semibold text-base m-0">{pickedHex.toUpperCase()}</p>
                  <p className="text-text text-xs m-0 mt-0.5">rgb({picked.r}, {picked.g}, {picked.b})</p>
                </div>
                <button
                  onClick={() => copyToClipboard(pickedHex.toUpperCase())}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {copied === pickedHex.toUpperCase() ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                  Copy HEX
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {Object.entries(formats).map(([label, value]) => (
                  <ColorRow key={label} label={label} value={value} onCopy={copyToClipboard} copied={copied} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: history */}
        <div className="lg:col-span-1 flex flex-col">
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 sticky top-20 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-sm font-semibold text-textHeader m-0">History</h2>
              {history.length > 0 && (
                <button
                  onClick={() => setHistory([])}
                  className="text-xs text-text bg-transparent border-none cursor-pointer hover:text-accent transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Pipette size={28} className="text-text opacity-30 mx-auto mb-2" />
                <p className="text-text text-xs">Picked colors will appear here</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[400px]">
                {history.map((color, i) => {
                  const hex = hexFromRgb(color.r, color.g, color.b)
                  return (
                    <button
                      key={i}
                      onClick={() => { setPicked(color) }}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl border border-borderColor bg-backgroundColor hover:border-accent transition-colors cursor-pointer w-full text-left shrink-0"
                    >
                      <span
                        className="w-7 h-7 rounded-lg border border-borderColor shrink-0"
                        style={{ background: hex }}
                      />
                      <span className="text-[13px] text-textHeader font-mono truncate">{hex.toUpperCase()}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(hex.toUpperCase()) }}
                        className="ml-auto text-text hover:text-accent transition-colors bg-transparent border-none cursor-pointer p-1 shrink-0"
                      >
                        {copied === hex.toUpperCase() ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                      </button>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}