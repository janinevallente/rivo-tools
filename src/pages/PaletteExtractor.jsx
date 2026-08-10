import { useState, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Image as ImageIcon, Upload, X, Copy, Check, Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { rgbToHex } from '../utils/colorUtils'

const SWATCH_COUNTS = [4, 6, 8, 10]

// Simple k-means style color quantization via median-cut-ish bucketing
function extractPalette(imageData, count) {
  const { data } = imageData
  const pixels = []
  // sample every 4th pixel for performance
  for (let i = 0; i < data.length; i += 16) {
    const a = data[i + 3]
    if (a < 128) continue
    pixels.push([data[i], data[i + 1], data[i + 2]])
  }
  if (pixels.length === 0) return []

  // k-means
  let centroids = []
  for (let i = 0; i < count; i++) {
    centroids.push(pixels[Math.floor((i / count) * pixels.length)])
  }

  for (let iter = 0; iter < 8; iter++) {
    const buckets = Array.from({ length: count }, () => [])
    for (const p of pixels) {
      let best = 0, bestDist = Infinity
      for (let c = 0; c < centroids.length; c++) {
        const cen = centroids[c]
        const dist = (p[0] - cen[0]) ** 2 + (p[1] - cen[1]) ** 2 + (p[2] - cen[2]) ** 2
        if (dist < bestDist) { bestDist = dist; best = c }
      }
      buckets[best].push(p)
    }
    centroids = centroids.map((cen, i) => {
      const bucket = buckets[i]
      if (bucket.length === 0) return cen
      const sum = bucket.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0])
      return [
        Math.round(sum[0] / bucket.length),
        Math.round(sum[1] / bucket.length),
        Math.round(sum[2] / bucket.length),
      ]
    })
  }

  // Sort by frequency (count of nearest pixels)
  const counts = new Array(centroids.length).fill(0)
  for (const p of pixels) {
    let best = 0, bestDist = Infinity
    for (let c = 0; c < centroids.length; c++) {
      const cen = centroids[c]
      const dist = (p[0] - cen[0]) ** 2 + (p[1] - cen[1]) ** 2 + (p[2] - cen[2]) ** 2
      if (dist < bestDist) { bestDist = dist; best = c }
    }
    counts[best]++
  }

  return centroids
    .map((c, i) => ({ rgb: c, count: counts[i] }))
    .sort((a, b) => b.count - a.count)
    .map(({ rgb }) => ({ r: rgb[0], g: rgb[1], b: rgb[2] }))
}

export default function PaletteExtractor() {
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [palette, setPalette] = useState(null)
  const [swatchCount, setSwatchCount] = useState(6)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [copied, setCopied] = useState(null)
  const inputRef = useRef()

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
    setPalette(null)
  }

  const handleFileChange = (e) => loadFile(e.target.files[0])
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0])
  }, [])
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  const runExtraction = useCallback(async (count) => {
    if (!preview) return
    setLoading(true)
    try {
      const img = new Image()
      img.src = preview
      await new Promise(r => { img.onload = r })
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 200 / Math.max(img.width, img.height))
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const colors = extractPalette(imageData, count)
      setPalette(colors.map(c => rgbToHex(c.r, c.g, c.b).toUpperCase()))
    } catch {
      setPalette(null)
    }
    setLoading(false)
  }, [preview])

  const changeCount = (count) => {
    setSwatchCount(count)
    if (preview) runExtraction(count)
  }

  const reset = () => {
    setImage(null); setPreview(null); setPalette(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 1500)
  }, [])

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Palette Extractor</title>
      </Helmet>
      <PageHeader
        title="Palette Extractor"
        description="Extract a color palette from any image, right in your browser."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-textHeader m-0">Upload Image</h2>
            {image && (
              <button 
                onClick={reset} 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-errorBg text-error border border-errorBorder cursor-pointer hover:opacity-80 transition-opacity"
              >
                <Trash2 size={13} /> Clear
              </button>
            )}
          </div>

          {!preview ? (
            <div
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-xl px-6 py-12 text-center cursor-pointer transition-all
                ${dragOver ? 'border-accent bg-accentBg' : 'border-borderColor bg-transparent hover:border-accent hover:bg-accentBg'}`}
            >
              <Upload size={40} className="text-accent mx-auto mb-3" />
              <p className="font-medium text-sm text-textHeader mb-1">Drop image here or click to upload</p>
              <p className="text-text text-xs">PNG, JPG, WebP supported</p>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          ) : (
            <div className="rounded-[10px] overflow-hidden border border-borderColor min-h-[200px] flex items-center justify-center bg-backgroundColor">
              <img src={preview} alt="Preview" className="max-w-full max-h-80 object-contain block" />
            </div>
          )}

          {/* Swatch count */}
          <div className="mt-4">
            <label className="text-[11px] font-semibold text-accent block mb-2">Number of Colors</label>
            <div className="flex gap-2">
              {SWATCH_COUNTS.map(count => (
                <button
                  key={count}
                  onClick={() => changeCount(count)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border cursor-pointer transition-colors
                    ${swatchCount === count
                      ? 'bg-accentBg text-accent border-accentBorder'
                      : 'bg-backgroundColor text-text border-borderColor hover:border-accent hover:text-accent'
                    }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => runExtraction(swatchCount)}
            disabled={!image || loading}
            className={`w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-all border-none
              ${image && !loading
                ? 'bg-accent text-white cursor-pointer hover:opacity-90'
                : 'bg-borderColor text-text cursor-not-allowed'
              }`}
          >
            {loading ? 'Extracting…' : 'Extract Palette'}
          </button>
        </div>

        {/* Result */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-textHeader m-0 mb-4">Palette</h2>

          {!palette ? (
            <div className="text-center text-text text-[13px] p-12 border border-dashed border-borderColor rounded-xl">
              <ImageIcon size={36} className="mx-auto mb-2.5 opacity-40" />
              Extracted colors will appear here
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {palette.map((color, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div
                    className="w-full aspect-[2/1] rounded-xl border border-borderColor"
                    style={{ background: color }}
                  />
                  <button
                    onClick={() => copyToClipboard(color)}
                    className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-mono bg-backgroundColor border border-borderColor text-textHeader cursor-pointer hover:border-accent hover:text-accent transition-colors"
                  >
                    {copied === color ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    {color}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
