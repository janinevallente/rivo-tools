import { useState, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Upload, Download, X, Loader2, Image as ImageIcon, Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

export default function ImageClipper() {
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [info, setInfo] = useState(null) // { before, after }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef()

  const loadFile = (file) => {
    if (!file) return
    if (file.type !== 'image/png') {
      setError('Only PNG files are supported (transparency required).')
      return
    }
    setError(null)
    setResult(null)
    setInfo(null)
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleFileChange = (e) => loadFile(e.target.files[0])
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0])
  }, [])
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  const trimImage = async () => {
    if (!image) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const img = new Image()
      img.src = preview
      await new Promise(r => { img.onload = r })

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)

      // Find bounding box of non-transparent pixels
      let top = height, bottom = 0, left = width, right = 0

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const alpha = data[(y * width + x) * 4 + 3]
          if (alpha > 0) {
            if (y < top) top = y
            if (y > bottom) bottom = y
            if (x < left) left = x
            if (x > right) right = x
          }
        }
      }

      if (top > bottom || left > right) {
        setError('Image appears to be fully transparent.')
        setLoading(false)
        return
      }

      const trimWidth = right - left + 1
      const trimHeight = bottom - top + 1

      const trimCanvas = document.createElement('canvas')
      trimCanvas.width = trimWidth
      trimCanvas.height = trimHeight
      const trimCtx = trimCanvas.getContext('2d')
      trimCtx.drawImage(canvas, left, top, trimWidth, trimHeight, 0, 0, trimWidth, trimHeight)

      setResult(trimCanvas.toDataURL('image/png'))
      setInfo({
        before: { w: width, h: height },
        after: { w: trimWidth, h: trimHeight },
      })
    } catch {
      setError('Failed to process the image.')
    }

    setLoading(false)
  }

  const download = () => {
    const a = document.createElement('a')
    a.href = result
    a.download = `trimmed-${image.name}`
    a.click()
  }

  const reset = () => {
    setImage(null); setPreview(null); setResult(null); setInfo(null); setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const checkerboard = { background: 'repeating-conic-gradient(var(--color-border) 0% 25%, var(--color-surface) 0% 50%) 0 0 / 16px 16px' }

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Image Clipper</title>
      </Helmet>
      <PageHeader
        title="Image Clipper"
        description="Automatically trim transparent edges from PNG images down to the tightest bounding box."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Upload */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-textHeader m-0">Input PNG</h2>
            {image && (
              <button
                onClick={reset}
                 className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-errorBg text-error border border-errorBorder cursor-pointer hover:opacity-80 transition-opacity"
              >
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>

          {!preview ? (
            <div
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-xl px-6 py-12 text-center cursor-pointer transition-all flex-1 flex flex-col items-center justify-center
                ${dragOver ? 'border-accent bg-accentBg' : 'border-borderColor hover:border-accent hover:bg-accentBg'}`}
            >
              <Upload size={40} className="text-accent mx-auto mb-3" />
              <p className="font-medium text-sm text-textHeader mb-1">Drop a PNG here or click to upload</p>
              <p className="text-text text-xs">PNG only — transparency required for trimming</p>
              <input ref={inputRef} type="file" accept="image/png" className="hidden" onChange={handleFileChange} />
            </div>
          ) : (
            <div className="flex flex-col flex-1">
              <div className="rounded-[10px] overflow-hidden border border-borderColor min-h-[160px] sm:min-h-[200px] flex-1 flex items-center justify-center" style={checkerboard}>
                <img src={preview} alt="Input" className="max-w-full max-h-72 object-contain block" />
              </div>
              <p className="text-xs text-text mt-2">{image.name} · {(image.size / 1024).toFixed(1)} KB</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-2.5 mt-3 text-[13px] text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={trimImage}
            disabled={!image || loading}
            className={`w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-all border-none
              ${image && !loading
                ? 'bg-accent text-white cursor-pointer hover:opacity-90'
                : 'bg-borderColor text-text cursor-not-allowed'}`}
          >
            {loading
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Trimming…</span>
              : 'Trim Transparent Edges'
            }
          </button>
        </div>

        {/* Result */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-textHeader m-0">Result</h2>
            {result && (
              <button
                onClick={download}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
              >
                <Download size={13} /> Download PNG
              </button>
            )}
          </div>

          <div className="rounded-[10px] overflow-hidden border border-borderColor min-h-60 sm:min-h-80 flex-1 flex items-center justify-center" style={checkerboard}>
            {result ? (
              <img src={result} alt="Trimmed" className="max-w-full max-h-72 object-contain block" />
            ) : (
              <div className="text-center text-text text-[13px] p-8">
                <ImageIcon size={36} className="mx-auto mb-2.5 opacity-40" />
                Trimmed image will appear here
              </div>
            )}
          </div>

          {/* Stats */}
          {info && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-backgroundColor border border-borderColor rounded-xl p-3 text-center">
                <p className="text-[11px] text-text mb-1">Before</p>
                <p className="text-sm font-semibold text-textHeader">{info.before.w} × {info.before.h}</p>
                <p className="text-[11px] text-text">px</p>
              </div>
              <div className="bg-accentBg border border-accentBorder rounded-xl p-3 text-center">
                <p className="text-[11px] text-accent mb-1">After</p>
                <p className="text-sm font-semibold text-textHeader">{info.after.w} × {info.after.h}</p>
                <p className="text-[11px] text-accent">
                  {Math.round((1 - (info.after.w * info.after.h) / (info.before.w * info.before.h)) * 100)}% smaller area
                </p>
              </div>
            </div>
          )}

          {!info && (
            <div className="mt-4 p-3 bg-accentBg border border-accentBorder rounded-xl text-xs text-text">
              <span className="text-accent font-semibold">Tip:</span> Works best on icons, logos, and illustrations with transparent backgrounds.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}