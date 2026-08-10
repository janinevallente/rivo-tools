import { useState, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Upload, Download, Image as ImageIcon, Trash2 } from 'lucide-react'
import { removeBackground } from '@imgly/background-removal'
import PageHeader from '../components/ui/PageHeader'

export default function BackgroundRemover() {
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef()

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please upload a valid image file.')
      return
    }
    setError(null)
    setResult(null)
    setProgress(0)
    setProgressText('')
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleFileChange = (e) => loadFile(e.target.files[0])
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0])
  }, [])
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  const handleRemoveBackground = async () => {
    if (!image) return
    setLoading(true)
    setError(null)
    setResult(null)
    setProgress(0)
    setProgressText('Loading AI model…')

    try {
      const resultBlob = await removeBackground(image, {
        progress: (key, current, total) => {
          if (total > 0) {
            const pct = Math.round((current / total) * 100)
            setProgress(pct)
            if (key.includes('fetch')) setProgressText(`Downloading model… ${pct}%`)
            else if (key.includes('compute')) setProgressText(`Processing… ${pct}%`)
            else setProgressText(`${pct}%`)
          }
        },
      })
      setResult(URL.createObjectURL(resultBlob))
      setProgressText('Done!')
    } catch (err) {
      console.error(err)
      setError('Failed to remove background. Please try another image.')
    }

    setLoading(false)
  }

  const download = () => {
    const a = document.createElement('a')
    a.href = result
    a.download = `bg-removed-${image.name.replace(/\.[^/.]+$/, '')}.png`
    a.click()
  }

  const reset = () => {
    setImage(null); setPreview(null); setResult(null); setError(null)
    setProgress(0); setProgressText('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const checkerboard = { background: 'repeating-conic-gradient(var(--color-border) 0% 25%, var(--color-surface) 0% 50%) 0 0 / 16px 16px' }

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Background Remover</title>
      </Helmet>
      <PageHeader
        title="Background Remover"
        description="Remove backgrounds from any image using AI — runs entirely in your browser. Output is a transparent PNG."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Upload Panel */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-xs sm:text-sm font-semibold text-textHeader m-0">Upload Image</h2>
            {image && (
              <button
                onClick={reset}
                title="Clear history"
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
                ${dragOver ? 'border-accent bg-accentBg' : 'border-borderColor bg-transparent hover:border-accent hover:bg-accentBg'}`}
            >
              <Upload size={32} className="text-accent mx-auto mb-2.5 sm:mb-3 sm:size-10" />
              <p className="font-medium text-xs sm:text-sm text-textHeader mb-1">Drop image here or click to upload</p>
              <p className="text-text text-[11px] sm:text-xs">PNG, JPG, WebP supported</p>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          ) : (
            <div className="flex flex-col flex-1">
              <div className="rounded-[10px] overflow-hidden border border-borderColor min-h-[160px] sm:min-h-[200px] flex-1 flex items-center justify-center" style={checkerboard}>
                <img src={preview} alt="Preview" className="max-w-full max-h-64 sm:max-h-80 object-contain block" />
              </div>
              <p className="text-[11px] sm:text-xs text-text mt-2 mb-0">
                {image?.name} · {(image?.size / 1024).toFixed(1)} KB
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-400/30 rounded-lg px-3 sm:px-3.5 py-2 sm:py-2.5 mt-3 text-xs sm:text-[13px] text-red-500">
              {error}
            </div>
          )}

          {/* Progress bar */}
          {loading && (
            <div className="mt-4">
              <div className="flex justify-between text-[11px] sm:text-xs text-text mb-1.5">
                <span>{progressText}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-borderColor rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-accent h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleRemoveBackground}
            disabled={!image || loading}
            className={`w-full mt-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border-none
              ${image && !loading
                ? 'bg-accent text-white cursor-pointer hover:opacity-90'
                : 'bg-borderColor text-text cursor-not-allowed'
              }`}
          >
            {loading ? 'Processing…' : 'Remove Background'}
          </button>
        </div>

        {/* Result Panel */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <h2 className="text-xs sm:text-sm font-semibold text-textHeader m-0">Result</h2>
            {result && (
              <button
                onClick={download}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity shrink-0"
              >
                <Download size={13} /> Download PNG
              </button>
            )}
          </div>

          <div className="rounded-[10px] overflow-hidden border border-borderColor min-h-60 sm:min-h-80 flex-1 flex items-center justify-center" style={checkerboard}>
            {result ? (
              <img src={result} alt="Result" className="max-w-full max-h-64 sm:max-h-80 object-contain block" />
            ) : (
              <div className="text-center text-text text-xs sm:text-[13px] p-6 sm:p-8">
                <ImageIcon size={30} className="mx-auto mb-2.5 opacity-40 sm:size-9" />
                Processed image will appear here
              </div>
            )}
          </div>

          <div className="mt-4 p-2.5 sm:p-3 bg-accentBg border border-accentBorder rounded-xl text-[11px] sm:text-xs text-text">
            <span className="text-accent font-semibold">Note:</span> The first run downloads the AI model (~20MB). Subsequent runs are instant — the model is cached in your browser.
          </div>
        </div>
      </div>
    </div>
  )
}