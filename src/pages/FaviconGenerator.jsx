import { useState, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Upload, Download, Copy, Check, X, Loader2 } from 'lucide-react'
import JSZip from 'jszip'
import PageHeader from '../components/ui/PageHeader'

// Constants
const SIZES = [
  { size: 16,  label: '16×16',   tag: null },
  { size: 32,  label: '32×32',   tag: null },
  { size: 48,  label: '48×48',   tag: null },
  { size: 64,  label: '64×64',   tag: null },
  { size: 128, label: '128×128', tag: null },
  { size: 180, label: '180×180', tag: 'Apple Touch' },
  { size: 192, label: '192×192', tag: 'Android' },
  { size: 512, label: '512×512', tag: 'PWA' },
]

const HTML_SNIPPET = (sizes) =>
  sizes
    .filter(({ size }) => [16, 32, 180, 192, 512].includes(size))
    .map(({ size, tag }) => {
      if (tag === 'Apple Touch')
        return `<link rel="apple-touch-icon" sizes="${size}x${size}" href="/favicon-${size}x${size}.png">`
      return `<link rel="icon" type="image/png" sizes="${size}x${size}" href="/favicon-${size}x${size}.png">`
    })
    .join('\n')

// Centre-crop src image to a square canvas of `size` pixels
function cropToCanvas(img, size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const src = Math.min(img.naturalWidth, img.naturalHeight)
  const sx  = (img.naturalWidth  - src) / 2
  const sy  = (img.naturalHeight - src) / 2

  ctx.drawImage(img, sx, sy, src, src, 0, 0, size, size)
  return canvas
}

function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((res) => canvas.toBlob(res, type))
}

// Minimal ICO writer: 1-image ICO containing the 32×32 PNG
async function buildIco(canvas32) {
  const pngBlob = await canvasToBlob(canvas32)
  const pngBuf  = await pngBlob.arrayBuffer()
  const png     = new Uint8Array(pngBuf)

  const headerSize  = 6
  const dirEntrySize = 16
  const imageOffset = headerSize + dirEntrySize
  const totalSize   = imageOffset + png.length
  const buf = new ArrayBuffer(totalSize)
  const dv  = new DataView(buf)

  // ICO header
  dv.setUint16(0, 0, true)  // reserved
  dv.setUint16(2, 1, true)  // type: ICO
  dv.setUint16(4, 1, true)  // 1 image

  // Directory entry
  dv.setUint8 (6,  32)                  // width  (0 = 256)
  dv.setUint8 (7,  32)                  // height
  dv.setUint8 (8,  0)                   // color count
  dv.setUint8 (9,  0)                   // reserved
  dv.setUint16(10, 1,           true)   // planes
  dv.setUint16(12, 32,          true)   // bit count
  dv.setUint32(14, png.length,  true)   // bytes in image
  dv.setUint32(18, imageOffset, true)   // offset

  new Uint8Array(buf).set(png, imageOffset)
  return new Blob([buf], { type: 'image/x-icon' })
}

export default function FaviconGenerator() {
  const [sourceFile, setSourceFile] = useState(null)   // { file, objectUrl, img }
  const [previews,   setPreviews]   = useState([])     // [{ size, label, tag, objectUrl }]
  const [generating, setGenerating] = useState(false)
  const [dragOver,   setDragOver]   = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const inputRef = useRef()

  // File intake
  const loadImage = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return

    // Revoke previous URLs
    if (sourceFile) URL.revokeObjectURL(sourceFile.objectUrl)
    previews.forEach(p => URL.revokeObjectURL(p.objectUrl))
    setPreviews([])

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setSourceFile({ file, objectUrl, img })
      generate(img)
    }
    img.src = objectUrl
  }, [sourceFile, previews]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = (e) => loadImage(e.target.files[0])
  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    loadImage(e.dataTransfer.files[0])
  }
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  const clearSource = () => {
    if (sourceFile) URL.revokeObjectURL(sourceFile.objectUrl)
    previews.forEach(p => URL.revokeObjectURL(p.objectUrl))
    setSourceFile(null)
    setPreviews([])
    if (inputRef.current) inputRef.current.value = ''
  }

  // Generation helper
  const generate = useCallback(async (img) => {
    setGenerating(true)
    const results = []

    for (const { size, label, tag } of SIZES) {
      const canvas = cropToCanvas(img, size)
      const blob   = await canvasToBlob(canvas)
      results.push({ size, label, tag, objectUrl: URL.createObjectURL(blob), blob })
    }

    setPreviews(results)
    setGenerating(false)
  }, [])

  // Download ico helper
  const downloadIco = async () => {
    const entry = previews.find(p => p.size === 32)
    if (!entry) return
    const canvas = cropToCanvas(sourceFile.img, 32)
    const icoBlob = await buildIco(canvas)
    triggerDownload(icoBlob, 'favicon.ico')
  }

  const downloadAll = async () => {
    const zip = new JSZip()
    for (const { size, blob } of previews) {
      zip.file(`favicon-${size}x${size}.png`, blob)
    }
    const canvas32  = cropToCanvas(sourceFile.img, 32)
    const icoBlob   = await buildIco(canvas32)
    zip.file('favicon.ico', icoBlob)
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    triggerDownload(zipBlob, 'favicons.zip')
  }

  const downloadSingle = (entry) => {
    triggerDownload(entry.blob, `favicon-${entry.size}x${entry.size}.png`)
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Snippet copy
  const copySnippet = () => {
    navigator.clipboard.writeText(HTML_SNIPPET(SIZES))
    setCopiedSnippet(true)
    setTimeout(() => setCopiedSnippet(false), 1800)
  }

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Favicon Generator</title>
      </Helmet>
      <PageHeader
        title="Favicon Generator"
        description="Generate favicons in all standard sizes from any image."
      />

      {/* Drop zone / source preview */}
      <div className="bg-backgroundCard border border-borderColor rounded-2xl overflow-hidden">
        {!sourceFile ? (
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-colors py-14 mx-6 my-6
              ${dragOver
                ? 'border-accent bg-accentBg'
                : 'border-borderColor hover:border-accent hover:bg-accentBg'
              }`}
          >
            <Upload size={32} className="text-accent mx-auto sm:size-10" />
            <div className="text-center">
                <p className="text-sm font-medium text-textHeader m-0">Drop an image here</p>
                <p className="text-xs text-text m-0 mt-1">
                    PNG, JPEG, WebP, SVG<span className="hidden sm:inline"> — </span>
                    <br className="sm:hidden" />
                    <span className="hidden sm:inline">any square or non-square image</span>
                    <span className="sm:hidden">any square or non-square image</span>
                </p>
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
        ) : (
          <>
            {/* Source row */}
            <div className="flex items-center gap-4 px-4 py-5">
              <img
                src={sourceFile.objectUrl}
                alt="source"
                className="w-14 h-14 rounded-xl object-cover border border-borderColor shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-textHeader m-0 truncate">{sourceFile.file.name}</p>
                <p className="text-xs text-text m-0 mt-0.5">Image will be centre-cropped to a square for each size.</p>
              </div>
              <button
                onClick={clearSource}
                className="text-text hover:text-accent transition-colors bg-transparent border-none cursor-pointer p-1 shrink-0"
                title="Clear"
              >
                <X size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Generating spinner */}
      {generating && (
        <div className="flex items-center justify-center gap-2 py-10 text-text text-sm">
          <Loader2 size={16} className="animate-spin text-accent" />
          Generating favicons…
        </div>
      )}

      {/* Generated previews */}
      {previews.length > 0 && (
        <>
          <div className="mt-5 bg-backgroundCard border border-borderColor rounded-2xl overflow-hidden">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 px-3 sm:px-4 py-3 border-b border-borderColor">
                <span className="text-xs sm:text-sm font-semibold text-textHeader">Generated Favicons</span>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                        onClick={downloadIco}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium bg-backgroundColor text-text border border-borderColor cursor-pointer hover:border-accentBorder hover:text-accent transition-colors"
                    >
                    <Download size={11} /> Download .ico
                    </button>
                    <button
                        onClick={downloadAll}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium bg-accent text-white border-none cursor-pointer hover:opacity-90 transition-opacity"
                    >
                    <Download size={11} /> Download All
                    </button>
                </div>
            </div>
            {/* Size rows */}
            {previews.map((entry) => (
              <div
                key={entry.size}
                className="flex items-center gap-4 px-4 py-3 border-t border-borderColor first:border-t-0 hover:bg-backgroundColor/50 transition-colors group"
              >
                {/* Preview thumbnail — actual pixels rendered at visual size */}
                <div className="w-14 h-14 flex items-center justify-center shrink-0">
                  <img
                    src={entry.objectUrl}
                    alt={entry.label}
                    style={{ width: Math.min(entry.size, 56), height: Math.min(entry.size, 56) }}
                    className="rounded object-cover"
                  />
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-textHeader m-0">{entry.label}</p>
                  {entry.tag && (
                    <p className="text-xs text-text m-0 mt-0.5">{entry.tag}</p>
                  )}
                </div>

                {/* Download single */}
                <button
                  onClick={() => downloadSingle(entry)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity opacity-0 group-hover:opacity-100"
                >
                  <Download size={11} /> Save
                </button>
              </div>
            ))}
          </div>

          {/* HTML Snippet */}
          <div className="mt-4 bg-backgroundCard border border-borderColor rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-borderColor">
              <span className="text-sm font-semibold text-textHeader">HTML Snippet</span>
              <button
                onClick={copySnippet}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
              >
                {copiedSnippet
                  ? <><Check size={11} className="text-green-400" /> Copied!</>
                  : <><Copy size={11} /> Copy</>
                }
              </button>
            </div>
            <pre className="px-4 py-3 text-xs font-mono text-text overflow-x-auto m-0 whitespace-pre-wrap">
              {HTML_SNIPPET(SIZES)}
            </pre>
          </div>
        </>
      )}
    </div>
  )
}