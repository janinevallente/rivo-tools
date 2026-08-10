import { useState, useRef, useCallback, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { 
  CircleDashed,
  Upload,
  Download,
  X,
  Loader2,
  ZoomIn,
  ZoomOut,
  Move,
  Maximize2,
  Minus,
  Plus,
  Trash2
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

export default function CircleCropper() {
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  // Circle overlay controls
  const [circleRadius, setCircleRadius] = useState(150) // radius in pixels
  const [circleCenter, setCircleCenter] = useState({ x: 200, y: 200 }) // center position
  const [isDraggingCircle, setIsDraggingCircle] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [imgNaturalSize, setImgNaturalSize] = useState(null)

  const inputRef = useRef()
  const canvasRef = useRef()
  const containerRef = useRef()
  const imageRef = useRef()

  const CANVAS_SIZE = 400 // preview container size

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please upload a valid image file.')
      return
    }
    setError(null)
    setResult(null)
    setImage(file)
    const url = URL.createObjectURL(file)
    setPreview(url)
    const img = new Image()
    img.onload = () => {
      setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
      // Reset circle to center
      setCircleCenter({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 })
      setCircleRadius(Math.min(CANVAS_SIZE / 3, 150))
    }
    img.src = url
  }

  const handleFileChange = (e) => loadFile(e.target.files[0])
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0])
  }, [])
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  // Calculate if point is inside circle (for dragging)
  const isPointInCircle = (x, y) => {
    const dx = x - circleCenter.x
    const dy = y - circleCenter.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance <= circleRadius
  }

  // Calculate if point is on resize handle (bottom-right edge of circle)
  const isPointOnResizeHandle = (x, y) => {
    const handleX = circleCenter.x + circleRadius * 0.85
    const handleY = circleCenter.y + circleRadius * 0.85
    const distance = Math.sqrt((x - handleX) ** 2 + (y - handleY) ** 2)
    return distance <= 12
  }

  // Mouse/Touch handlers for dragging circle
  const onMouseDown = (e) => {
    if (!imgNaturalSize) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const scale = CANVAS_SIZE / rect.width
    const mouseX = (e.clientX - rect.left) * scale
    const mouseY = (e.clientY - rect.top) * scale
    
    if (isPointOnResizeHandle(mouseX, mouseY)) {
      setIsResizing(true)
      setDragStart({ x: mouseX, y: mouseY, radius: circleRadius })
    } else if (isPointInCircle(mouseX, mouseY)) {
      setIsDraggingCircle(true)
      setDragStart({ x: mouseX - circleCenter.x, y: mouseY - circleCenter.y })
    }
    
    e.preventDefault()
  }

  const onMouseMove = (e) => {
    if (!isDraggingCircle && !isResizing) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const scale = CANVAS_SIZE / rect.width
    const mouseX = (e.clientX - rect.left) * scale
    const mouseY = (e.clientY - rect.top) * scale
    
    if (isDraggingCircle && dragStart) {
      // Move circle center
      let newX = mouseX - dragStart.x
      let newY = mouseY - dragStart.y
      
      // Constrain within bounds (keep circle inside canvas)
      newX = Math.min(Math.max(newX, circleRadius), CANVAS_SIZE - circleRadius)
      newY = Math.min(Math.max(newY, circleRadius), CANVAS_SIZE - circleRadius)
      
      setCircleCenter({ x: newX, y: newY })
    } else if (isResizing && dragStart) {
      // Resize circle based on mouse distance from center
      const dx = mouseX - circleCenter.x
      const dy = mouseY - circleCenter.y
      const newRadius = Math.sqrt(dx * dx + dy * dy)
      
      // Constrain radius
      const minRadius = 30
      const maxRadius = Math.min(circleCenter.x, circleCenter.y, CANVAS_SIZE - circleCenter.x, CANVAS_SIZE - circleCenter.y, 180)
      const clampedRadius = Math.min(Math.max(newRadius, minRadius), maxRadius)
      
      setCircleRadius(clampedRadius)
    }
  }

  const onMouseUp = () => {
    setIsDraggingCircle(false)
    setIsResizing(false)
    setDragStart(null)
  }

  // Touch support
  const onTouchStart = (e) => {
    const touch = e.touches[0]
    const rect = containerRef.current.getBoundingClientRect()
    const scale = CANVAS_SIZE / rect.width
    const touchX = (touch.clientX - rect.left) * scale
    const touchY = (touch.clientY - rect.top) * scale
    
    if (isPointOnResizeHandle(touchX, touchY)) {
      setIsResizing(true)
      setDragStart({ x: touchX, y: touchY, radius: circleRadius })
    } else if (isPointInCircle(touchX, touchY)) {
      setIsDraggingCircle(true)
      setDragStart({ x: touchX - circleCenter.x, y: touchY - circleCenter.y })
    }
  }

  const onTouchMove = (e) => {
    if (!isDraggingCircle && !isResizing) return
    e.preventDefault()
    
    const touch = e.touches[0]
    const rect = containerRef.current.getBoundingClientRect()
    const scale = CANVAS_SIZE / rect.width
    const touchX = (touch.clientX - rect.left) * scale
    const touchY = (touch.clientY - rect.top) * scale
    
    if (isDraggingCircle && dragStart) {
      let newX = touchX - dragStart.x
      let newY = touchY - dragStart.y
      newX = Math.min(Math.max(newX, circleRadius), CANVAS_SIZE - circleRadius)
      newY = Math.min(Math.max(newY, circleRadius), CANVAS_SIZE - circleRadius)
      setCircleCenter({ x: newX, y: newY })
    } else if (isResizing && dragStart) {
      const dx = touchX - circleCenter.x
      const dy = touchY - circleCenter.y
      const newRadius = Math.sqrt(dx * dx + dy * dy)
      const minRadius = 30
      const maxRadius = Math.min(circleCenter.x, circleCenter.y, CANVAS_SIZE - circleCenter.x, CANVAS_SIZE - circleCenter.y, 180)
      const clampedRadius = Math.min(Math.max(newRadius, minRadius), maxRadius)
      setCircleRadius(clampedRadius)
    }
  }

  // Reset circle to center
  const resetCircle = () => {
    setCircleCenter({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 })
    setCircleRadius(Math.min(CANVAS_SIZE / 3, 150))
  }

  const cropToCircle = async () => {
    if (!preview || !imgNaturalSize) return
    setLoading(true)
    setError(null)

    try {
      const img = new Image()
      img.src = preview
      await new Promise(r => { img.onload = r })

      // Calculate scale between natural image size and displayed size
      const displayScale = Math.min(CANVAS_SIZE / imgNaturalSize.w, CANVAS_SIZE / imgNaturalSize.h)
      const imgDisplayWidth = imgNaturalSize.w * displayScale
      const imgDisplayHeight = imgNaturalSize.h * displayScale
      const imgDisplayX = (CANVAS_SIZE - imgDisplayWidth) / 2
      const imgDisplayY = (CANVAS_SIZE - imgDisplayHeight) / 2

      // Map circle position from display space to image space
      const relativeX = (circleCenter.x - imgDisplayX) / displayScale
      const relativeY = (circleCenter.y - imgDisplayY) / displayScale
      const relativeRadius = circleRadius / displayScale

      // Create output canvas (square based on circle diameter)
      const outputSize = Math.floor(relativeRadius * 2)
      const out = document.createElement('canvas')
      out.width = outputSize
      out.height = outputSize
      const ctx = out.getContext('2d')

      // Calculate source region in original image
      const srcX = relativeX - relativeRadius
      const srcY = relativeY - relativeRadius
      const srcSize = relativeRadius * 2

      // Draw the circular crop
      ctx.beginPath()
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, outputSize, outputSize)

      setResult(out.toDataURL('image/png'))
    } catch (err) {
      console.error(err)
      setError('Failed to process image.')
    }

    setLoading(false)
  }

  const download = () => {
    const a = document.createElement('a')
    a.href = result
    a.download = `circle-${image?.name?.replace(/\.[^/.]+$/, '') || 'crop'}.png`
    a.click()
  }

  const reset = () => {
    setImage(null); setPreview(null); setResult(null); setError(null)
    setImgNaturalSize(null)
    resetCircle()
    if (inputRef.current) inputRef.current.value = ''
  }

  // Get image display style (centered, fitting container)
  const getImgStyle = () => {
    if (!imgNaturalSize) return { display: 'none' }
    const scale = Math.min(CANVAS_SIZE / imgNaturalSize.w, CANVAS_SIZE / imgNaturalSize.h)
    const width = imgNaturalSize.w * scale
    const height = imgNaturalSize.h * scale
    return {
      width,
      height,
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginTop: -height / 2,
      marginLeft: -width / 2,
      userSelect: 'none',
      pointerEvents: 'none',
    }
  }

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Circle Cropper</title>
      </Helmet>
      <PageHeader
        title="Circle Cropper"
        description="Drag to move the circle, drag the handle to resize. Crop any image into a perfect circle."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Upload + Controls */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-textHeader m-0">Crop Area</h2>
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
              className={`border-2 border-dashed rounded-xl px-6 py-12 text-center cursor-pointer transition-all flex-1 flex flex-col items-center justify-center
                ${dragOver ? 'border-accent bg-accentBg' : 'border-borderColor hover:border-accent hover:bg-accentBg'}`}
            >
              <Upload size={40} className="text-accent mx-auto mb-3" />
              <p className="font-medium text-sm text-textHeader mb-1">Drop an image or click to upload</p>
              <p className="text-text text-xs">PNG, JPG, WebP supported</p>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          ) : (
            <div className="flex flex-col gap-4 flex-1">
              {/* Circle preview with overlay */}
              <div className="flex justify-center flex-1 items-center">
                <div
                  ref={containerRef}
                  style={{
                    width: CANVAS_SIZE,
                    height: CANVAS_SIZE,
                    position: 'relative',
                    overflow: 'hidden',
                    border: '2px solid var(--tw-border-opacity, 1)',
                    borderRadius: '12px',
                    background: 'repeating-conic-gradient(var(--color-border) 0% 25%, var(--color-surface) 0% 50%) 0 0 / 16px 16px',
                    cursor: isDraggingCircle ? 'grabbing' : 'grab',
                  }}
                  className="border-borderColor select-none"
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onMouseUp}
                >
                  {/* Image */}
                  {preview && (
                    <img
                      ref={imageRef}
                      src={preview}
                      alt="Crop preview"
                      style={getImgStyle()}
                      draggable={false}
                    />
                  )}

                  {/* Circle Overlay */}
                  {imgNaturalSize && (
                    <>
                      {/* Semi-transparent overlay outside circle */}
                      <svg
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: CANVAS_SIZE,
                          height: CANVAS_SIZE,
                          pointerEvents: 'none',
                        }}
                      >
                        <defs>
                          <clipPath id="circleClip">
                            <rect width={CANVAS_SIZE} height={CANVAS_SIZE} />
                            <circle
                              cx={circleCenter.x}
                              cy={circleCenter.y}
                              r={circleRadius}
                              fill="black"
                            />
                          </clipPath>
                        </defs>
                        <rect
                          width={CANVAS_SIZE}
                          height={CANVAS_SIZE}
                          fill="rgba(0,0,0,0.6)"
                          clipPath="url(#circleClip)"
                        />
                      </svg>

                      {/* Circle border */}
                      <svg
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: CANVAS_SIZE,
                          height: CANVAS_SIZE,
                          pointerEvents: 'none',
                        }}
                      >
                        <circle
                          cx={circleCenter.x}
                          cy={circleCenter.y}
                          r={circleRadius}
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeDasharray="5,5"
                        />
                        <circle
                          cx={circleCenter.x}
                          cy={circleCenter.y}
                          r={circleRadius}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                        />
                      </svg>

                      {/* Resize handle */}
                      <div
                        style={{
                          position: 'absolute',
                          left: circleCenter.x + circleRadius * 0.85 - 8,
                          top: circleCenter.y + circleRadius * 0.85 - 8,
                          width: 16,
                          height: 16,
                          backgroundColor: '#3b82f6',
                          border: '2px solid white',
                          borderRadius: '50%',
                          cursor: 'nw-resize',
                          pointerEvents: 'none',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        }}
                      />
                    </>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-text text-center flex items-center justify-center gap-2">
                <Move size={11} /> Drag circle to move • <span className="inline-block w-3 h-3 rounded-full bg-accent" /> Drag handle to resize
              </p>

              {/* Radius indicator */}
              <div className="text-center text-xs text-text">
                Circle size: {Math.round(circleRadius * 2)}px diameter
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-2.5 mt-3 text-[13px] text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={cropToCircle}
            disabled={!image || loading}
            className={`w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-all border-none
              ${image && !loading
                ? 'bg-accent text-white cursor-pointer hover:opacity-90'
                : 'bg-borderColor text-text cursor-not-allowed'}`}
          >
            {loading
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Cropping…</span>
              : 'Crop to Circle'
            }
          </button>

          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
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

          <div
            className="rounded-xl border border-borderColor min-h-80 flex-1 flex items-center justify-center"
            style={{ background: 'repeating-conic-gradient(var(--color-border) 0% 25%, var(--color-surface) 0% 50%) 0 0 / 16px 16px' }}
          >
            {result ? (
              <img src={result} alt="Circle crop result" className="max-w-full max-h-80 object-contain block rounded-full shadow-lg" />
            ) : (
              <div className="text-center text-text text-[13px] p-8">
                <CircleDashed size={36} className="mx-auto mb-2.5 opacity-40" />
                Circle crop will appear here
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-accentBg border border-accentBorder rounded-xl text-xs text-text">
            <span className="text-accent font-semibold">Note:</span> Output is always a square PNG with a circular transparent mask. This is perfect for avatars and profile pictures.
          </div>
        </div>
      </div>
    </div>
  )
}