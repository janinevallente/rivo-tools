import { useState, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Upload, Download, X, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const FORMATS = ['PNG', 'JPEG', 'WebP', 'BMP', 'TIFF', 'AVIF']
const QUALITY_FORMATS = ['JPEG', 'WebP', 'AVIF']
const MIME = { PNG: 'image/png', JPEG: 'image/jpeg', WebP: 'image/webp', BMP: 'image/bmp', TIFF: 'image/tiff', AVIF: 'image/avif' }
const EXT = { PNG: 'png', JPEG: 'jpg', WebP: 'webp', BMP: 'bmp', TIFF: 'tiff', AVIF: 'avif' }
const FORMAT_INFO = [
  ['PNG', 'Lossless, transparency support'],
  ['JPEG', 'Lossy, small file size for photos'],
  ['WebP', 'Modern, efficient, transparency'],
  ['BMP', 'Uncompressed, large files'],
  ['TIFF', 'High quality, print use'],
  ['AVIF', 'Modern, highly efficient compression'],
]

export default function ImageConverter() {
  const [files, setFiles] = useState([])
  const [targetFormat, setTargetFormat] = useState('WebP')
  const [quality, setQuality] = useState(90)
  const [resizeEnabled, setResizeEnabled] = useState(false)
  const [resizeWidth, setResizeWidth] = useState('')
  const [resizeHeight, setResizeHeight] = useState('')
  const [maintainAspect, setMaintainAspect] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [converting, setConverting] = useState(false)
  const inputRef = useRef()

  const loadFiles = (incoming) => {
    const valid = [...incoming].filter(f => f.type.startsWith('image/'))
    if (!valid.length) return
    setFiles(prev => [...prev, ...valid.map(f => ({
      id: Math.random().toString(36).slice(2),
      file: f, preview: URL.createObjectURL(f),
      status: 'idle', resultUrl: null, error: null,
    }))])
  }

  const handleFileChange = (e) => loadFiles(e.target.files)
  const handleDrop = useCallback((e) => { e.preventDefault(); setDragOver(false); loadFiles(e.dataTransfer.files) }, [])
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)
  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id))

  const convertOne = (entry) => new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (resizeEnabled) {
          const rw = parseInt(resizeWidth) || 0
          const rh = parseInt(resizeHeight) || 0
          if (rw && rh) { w = rw; h = rh }
          else if (rw && maintainAspect) { w = rw; h = Math.round((img.height / img.width) * rw) }
          else if (rh && maintainAspect) { h = rh; w = Math.round((img.width / img.height) * rh) }
          else if (rw) { w = rw } else if (rh) { h = rh }
        }
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (['JPEG', 'BMP', 'TIFF'].includes(targetFormat)) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h) }
        ctx.drawImage(img, 0, 0, w, h)
        const q = QUALITY_FORMATS.includes(targetFormat) ? quality / 100 : undefined
        resolve({ ...entry, status: 'done', resultUrl: canvas.toDataURL(MIME[targetFormat] || 'image/png', q) })
      } catch { resolve({ ...entry, status: 'error', error: 'Conversion failed' }) }
    }
    img.onerror = () => resolve({ ...entry, status: 'error', error: 'Failed to load image' })
    img.src = entry.preview
  })

  const convertAll = async () => {
    if (!files.length) return
    setConverting(true)
    const updated = [...files]
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: 'converting' }
      setFiles([...updated])
      updated[i] = await convertOne(updated[i])
      setFiles([...updated])
    }
    setConverting(false)
  }

  const downloadOne = (entry) => {
    const a = document.createElement('a')
    a.href = entry.resultUrl
    a.download = `${entry.file.name.replace(/\.[^/.]+$/, '')}.${EXT[targetFormat]}`
    a.click()
  }

  const downloadAll = () => files.filter(f => f.status === 'done').forEach(downloadOne)
  const clearAll = () => { setFiles([]); if (inputRef.current) inputRef.current.value = '' }

  const doneCount = files.filter(f => f.status === 'done').length
  const inputClass = "w-full px-2.5 py-1.5 rounded-lg border border-borderColor bg-backgroundColor text-textHeader text-[13px] outline-none focus:border-accent transition-colors font-poppins"

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Image Converter</title>
      </Helmet>
      <PageHeader
        title="Image Converter"
        description="Convert images between PNG, JPEG, WebP, BMP, TIFF, AVIF — with optional resize. All processing happens in your browser."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings */}
        <div className="lg:col-span-1 flex flex-col gap-4">

          {/* Format picker */}
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 shadow-shadowColor">
            <h2 className="text-sm font-semibold text-textHeader mb-3 m-0">Output Format</h2>
            <div className="flex flex-wrap gap-3">
              {FORMATS.map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setTargetFormat(fmt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer font-poppins
                    ${targetFormat === fmt
                      ? 'bg-accent text-white border-accent'
                      : 'bg-backgroundColor text-text border-borderColor hover:border-accent hover:text-accent'
                    }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          {QUALITY_FORMATS.includes(targetFormat) && (
            <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 shadow-shadowColor">
              <div className="flex justify-between mb-2">
                <h2 className="text-sm font-semibold text-textHeader m-0">Quality</h2>
                <span className="text-accent font-semibold text-[13px]">{quality}%</span>
              </div>
              <input type="range" min={10} max={100} value={quality} onChange={e => setQuality(Number(e.target.value))} className="w-full accent-accent" />
              <div className="flex justify-between text-[11px] text-text mt-1">
                <span>Smaller</span><span>Better</span>
              </div>
            </div>
          )}

          {/* Resize */}
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 shadow-shadowColor">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-textHeader m-0">Resize</h2>
              <label className="flex items-center gap-1.5 cursor-pointer text-[13px] text-text">
                <input type="checkbox" checked={resizeEnabled} onChange={e => setResizeEnabled(e.target.checked)} className="accent-accent" />
                Enable
              </label>
            </div>
            {resizeEnabled && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-[11px] text-text block mb-1">Width (px)</label>
                    <input type="number" placeholder="auto" value={resizeWidth} onChange={e => setResizeWidth(e.target.value)} className={inputClass} />
                  </div>
                  <span className="text-text text-sm pb-2">×</span>
                  <div className="flex-1">
                    <label className="text-[11px] text-text block mb-1">Height (px)</label>
                    <input type="number" placeholder="auto" value={resizeHeight} onChange={e => setResizeHeight(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text">
                  <input type="checkbox" checked={maintainAspect} onChange={e => setMaintainAspect(e.target.checked)} className="accent-accent" />
                  Maintain aspect ratio
                </label>
              </div>
            )}
          </div>

          {/* Actions */}
          <button
            onClick={convertAll}
            disabled={!files.length || converting}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold border-none transition-all font-poppins
              ${files.length && !converting ? 'bg-accent text-white cursor-pointer hover:opacity-90' : 'bg-borderColor text-text cursor-not-allowed'}`}
          >
            {converting
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Converting…</span>
              : `Convert ${files.length ? `${files.length} Image${files.length > 1 ? 's' : ''}` : 'Images'}`
            }
          </button>

          {doneCount > 1 && (
            <button
              onClick={downloadAll}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity font-poppins"
            >
              <span className="flex items-center justify-center gap-2"><Download size={15} /> Download All ({doneCount})</span>
            </button>
          )}
        </div>

        {/* Files panel */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 shadow-shadowColor">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-textHeader m-0">
                Images {files.length > 0 && <span className="text-text font-normal">({files.length})</span>}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="border border-borderColor rounded-lg px-3 py-1 text-xs text-text bg-transparent cursor-pointer hover:border-accent hover:text-accent transition-colors font-poppins"
                >
                  + Add more
                </button>
                {files.length > 0 && (
                  <button 
                    onClick={clearAll} 
                     className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-errorBg text-error border border-errorBorder cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <Trash2 size={12} /> Clear all
                  </button>
                )}
              </div>
            </div>

            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />

            {files.length === 0 ? (
              <div
                onClick={() => inputRef.current?.click()}
                onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl px-6 py-14 text-center cursor-pointer transition-all
                  ${dragOver ? 'border-accent bg-accentBg' : 'border-borderColor hover:border-accent hover:bg-accentBg'}`}
              >
                <Upload size={44} className="text-accent mx-auto mb-3" />
                <p className="font-medium text-sm text-textHeader mb-1">Drop images here or click to upload</p>
                <p className="text-text text-xs">PNG, JPEG, WebP, BMP, TIFF supported · Multiple files OK</p>
              </div>
            ) : (
              <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className="flex flex-col gap-2">
                {files.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] border border-borderColor bg-backgroundColor">
                    <img src={entry.preview} alt="" className="w-11 h-11 object-cover rounded-md border border-borderColor shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-textHeader m-0 truncate">{entry.file.name}</p>
                      <p className="text-[11px] text-text m-0 mt-0.5">
                        {(entry.file.size / 1024).toFixed(1)} KB
                        {entry.status === 'done' && <span className="text-green-500 ml-2">✓ Converted to {targetFormat}</span>}
                        {entry.status === 'error' && <span className="text-red-500 ml-2">✕ {entry.error}</span>}
                        {entry.status === 'converting' && <span className="text-accent ml-2">Converting…</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {entry.status === 'done' && (
                        <button
                          onClick={() => downloadOne(entry)}
                          className="bg-accentBg border border-accentBorder text-accent rounded-md px-2.5 py-1 text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity font-poppins flex items-center gap-1"
                        >
                          <Download size={12} /> Save
                        </button>
                      )}
                      <button
                        onClick={() => removeFile(entry.id)}
                        className="bg-transparent border-none cursor-pointer text-text p-1 hover:text-red-500 transition-colors"
                        aria-label="Remove"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-text text-center mt-1">Drag more images here to add them</p>
              </div>
            )}
          </div>

          {/* Format guide */}
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 shadow-shadowColor">
            <h2 className="text-sm font-semibold text-textHeader mb-3 m-0">Format Guide</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-text">
              {FORMAT_INFO.map(([fmt, desc]) => (
                <div key={fmt} className="flex gap-2 py-0.5">
                  <span className="text-accent font-semibold min-w-[42px]">{fmt}</span>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}