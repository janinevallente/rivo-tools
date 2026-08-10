import { useState, useMemo, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { Check, X, RefreshCw, Target, Loader2, Info, Shuffle } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { 
  RawHexToRgb,
  RawRgbToHex,
  getLuminance,
  contrastRatio,
  wcagLevels,
  randomRgb
} from '../utils/colorUtils'


function ResultBadge({ pass, label }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium
      ${pass ? 'bg-green-500/10 border-green-400/30 text-green-400' : 'bg-red-500/10 border-red-400/30 text-red-500'}`}>
      <span>{label}</span>
      {pass ? <Check size={16} /> : <X size={16} />}
    </div>
  )
}



// GUARANTEED to find a color that meets contrast requirements
// Uses binary search on brightness while preserving hue
const findColorWithContrast = (foregroundRgb, originalBackgroundRgb, targetRatio) => {
  const fgLuminance = getLuminance(foregroundRgb)
  const originalLuminance = getLuminance(originalBackgroundRgb)
  
  // Determine if we need a lighter or darker background
  const needLighter = fgLuminance < 0.5
  
  let low = 0
  let high = 1
  let bestRgb = originalBackgroundRgb
  let bestRatio = contrastRatio(foregroundRgb, bestRgb)
  let iterations = 0
  const maxIterations = 50
  
  // Binary search to find the right luminance
  while (iterations < maxIterations) {
    if (bestRatio >= targetRatio) break
    
    const mid = (low + high) / 2
    let testLuminance
    
    if (needLighter) {
      testLuminance = originalLuminance + (mid * (1 - originalLuminance))
    } else {
      testLuminance = originalLuminance * (1 - mid)
    }
    
    // Convert target luminance to RGB while preserving hue
    const originalRatio = originalBackgroundRgb.r / Math.max(1, originalBackgroundRgb.g, originalBackgroundRgb.b)
    
    let testRgb
    if (needLighter) {
      // Make brighter
      const factor = testLuminance / originalLuminance
      testRgb = {
        r: Math.min(255, originalBackgroundRgb.r * factor),
        g: Math.min(255, originalBackgroundRgb.g * factor),
        b: Math.min(255, originalBackgroundRgb.b * factor)
      }
    } else {
      // Make darker
      const factor = testLuminance / originalLuminance
      testRgb = {
        r: originalBackgroundRgb.r * factor,
        g: originalBackgroundRgb.g * factor,
        b: originalBackgroundRgb.b * factor
      }
    }
    
    // Clamp to valid range
    testRgb.r = Math.min(255, Math.max(0, testRgb.r))
    testRgb.g = Math.min(255, Math.max(0, testRgb.g))
    testRgb.b = Math.min(255, Math.max(0, testRgb.b))
    
    const testRatio = contrastRatio(foregroundRgb, testRgb)
    
    if (testRatio > bestRatio) {
      bestRgb = testRgb
      bestRatio = testRatio
    }
    
    if (testRatio >= targetRatio) {
      break
    } else if (needLighter) {
      low = mid
    } else {
      high = mid
    }
    
    iterations++
  }
  
  // If binary search didn't work, do a linear search through grayscale
  if (bestRatio < targetRatio) {
    for (let i = 0; i <= 255; i++) {
      const grayValue = needLighter ? 255 - i : i
      const testRgb = { r: grayValue, g: grayValue, b: grayValue }
      const testRatio = contrastRatio(foregroundRgb, testRgb)
      
      if (testRatio > bestRatio) {
        bestRgb = testRgb
        bestRatio = testRatio
      }
      
      if (bestRatio >= targetRatio) break
    }
  }
  
  return bestRgb
}

// Fix function to find a contrast color
const fixContrastGuaranteed = (foregroundHex, backgroundHex, targetRatio, onProgress) => {
  const fgRgb = RawHexToRgb(foregroundHex)
  const bgRgb = RawHexToRgb(backgroundHex)
  
  if (!fgRgb || !bgRgb) return backgroundHex
  
  const currentRatio = contrastRatio(fgRgb, bgRgb)
  
  // Already meets requirement
  if (currentRatio >= targetRatio) {
    return backgroundHex
  }
  
  // Find a color that meets the requirement
  const fixedRgb = findColorWithContrast(fgRgb, bgRgb, targetRatio)
  const fixedHex = RawRgbToHex(fixedRgb.r, fixedRgb.g, fixedRgb.b)
  
  // Verify the fix worked
  const verifyRgb = RawHexToRgb(fixedHex)
  const finalRatio = contrastRatio(fgRgb, verifyRgb)
  
  // If somehow still not meeting target, try extreme colors
  if (finalRatio < targetRatio) {
    const extremeColors = [
      { r: 0, g: 0, b: 0 },     // Black
      { r: 255, g: 255, b: 255 } // White
    ]
    
    for (const extreme of extremeColors) {
      const extremeRatio = contrastRatio(fgRgb, extreme)
      if (extremeRatio >= targetRatio) {
        return RawRgbToHex(extreme.r, extreme.g, extreme.b)
      }
    }
  }
  
  return fixedHex
}

export default function ContrastChecker() {
  const [fg, setFg] = useState('#f3f4f6')
  const [bg, setBg] = useState('#16171d')
  const [fgInput, setFgInput] = useState('#f3f4f6')
  const [bgInput, setBgInput] = useState('#16171d')
  const [isFixing, setIsFixing] = useState(false)

  const fgRgb = useMemo(() => RawHexToRgb(fg), [fg])
  const bgRgb = useMemo(() => RawHexToRgb(bg), [bg])

  const ratio = useMemo(() => {
    if (!fgRgb || !bgRgb) return 0
    return contrastRatio(fgRgb, bgRgb)
  }, [fgRgb, bgRgb])

  const levels = wcagLevels(ratio)

  const handleFgInput = (val) => {
    setFgInput(val)
    const rgb = RawHexToRgb(val)
    if (rgb) setFg(RawRgbToHex(rgb.r, rgb.g, rgb.b))
  }

  const handleBgInput = (val) => {
    setBgInput(val)
    const rgb = RawHexToRgb(val)
    if (rgb) setBg(RawRgbToHex(rgb.r, rgb.g, rgb.b))
  }

  const handleFgPicker = (val) => {
    setFg(val)
    setFgInput(val)
  }

  const handleBgPicker = (val) => {
    setBg(val)
    setBgInput(val)
  }

  const swap = () => {
    const tmpFg = fg, tmpFgInput = fgInput
    setFg(bg); setFgInput(bgInput)
    setBg(tmpFg); setBgInput(tmpFgInput)
  }

  const randomize = () => {
    const r1 = randomRgb(), r2 = randomRgb()
    const h1 = RawRgbToHex(r1.r, r1.g, r1.b), h2 = RawRgbToHex(r2.r, r2.g, r2.b)
    setFg(h1); setFgInput(h1)
    setBg(h2); setBgInput(h2)
  }


  const fixToAA = useCallback(async () => {
    if (ratio >= 4.5 || isFixing) return
    
    setIsFixing(true)
    
    // Use setTimeout to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const newBg = fixContrastGuaranteed(fg, bg, 4.5)
    setBg(newBg)
    setBgInput(newBg)
    
    setIsFixing(false)
  }, [fg, bg, ratio, isFixing])

  const fixToAAA = useCallback(async () => {
    if (ratio >= 7.0 || isFixing) return
    
    setIsFixing(true)
    
    // Use setTimeout to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const newBg = fixContrastGuaranteed(fg, bg, 7.0)
    setBg(newBg)
    setBgInput(newBg)
    
    setIsFixing(false)
  }, [fg, bg, ratio, isFixing])

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Contrast Checker</title>
      </Helmet>    
      <PageHeader
        title="Contrast Checker"
        description="WCAG 2.1 color contrast compliance checker. Click fix buttons to automatically meet accessibility standards."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-textHeader m-0 shrink-0">Colors</h2>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={swap}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
              >
                <RefreshCw size={13} className="shrink-0" /> Swap
              </button>
              <button
                onClick={randomize}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
              >
                <Shuffle size={13} className="shrink-0" /> Randomize
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-semibold text-accent block mb-1.5">Foreground (text)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fg}
                  onChange={(e) => handleFgPicker(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-borderColor bg-transparent cursor-pointer p-0"
                />
                <input
                  type="text"
                  value={fgInput}
                  onChange={(e) => handleFgInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-backgroundColor border border-borderColor text-sm text-textHeader font-mono focus:outline-none focus:border-accent transition-colors"
                  placeholder="#RRGGBB"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-accent block mb-1.5">Background</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bg}
                  onChange={(e) => handleBgPicker(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-borderColor bg-transparent cursor-pointer p-0"
                />
                <input
                  type="text"
                  value={bgInput}
                  onChange={(e) => handleBgInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-backgroundColor border border-borderColor text-sm text-textHeader font-mono focus:outline-none focus:border-accent transition-colors"
                  placeholder="#RRGGBB"
                />
              </div>
            </div>
          </div>

          {/* Fix Contrast Buttons */}
          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <button
              onClick={fixToAA}
              disabled={ratio >= 4.5 || isFixing}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all text-center
                ${ratio >= 4.5 
                  ? 'bg-green-500/20 text-green-400 border border-green-400/30 cursor-default' 
                  : 'bg-accent text-white cursor-pointer hover:opacity-90'
                } ${isFixing ? 'opacity-50 cursor-wait' : ''}`}
            >
              {isFixing ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Target size={14} className="shrink-0" />}
              Fix to AA (4.5:1)
              {ratio >= 4.5 && ' ✓'}
            </button>
            <button
              onClick={fixToAAA}
              disabled={ratio >= 7.0 || isFixing}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all text-center
                ${ratio >= 7.0 
                  ? 'bg-green-500/20 text-green-400 border border-green-400/30 cursor-default' 
                  : 'bg-accent text-white cursor-pointer hover:opacity-90'
                } ${isFixing ? 'opacity-50 cursor-wait' : ''}`}
            >
              {isFixing ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Target size={14} className="shrink-0" />}
              Fix to AAA (7:1)
              {ratio >= 7.0 && ' ✓'}
            </button>
          </div>

          {/* Preview */}
          <div
            className="mt-5 rounded-xl border border-borderColor p-6 flex flex-col items-center justify-center gap-1 transition-colors"
            style={{ background: bg, color: fg }}
          >
            <span className="text-2xl font-bold">Aa</span>
            <span className="text-sm">The quick brown fox jumps over the lazy dog</span>
            <span className="text-xs opacity-80">Small text sample</span>
          </div>
        </div>

        {/* Results */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-textHeader m-0 mb-4">WCAG 2.1 Results</h2>

          <div className="text-center mb-5">
            <p className="text-4xl font-bold text-textHeader m-0">{ratio.toFixed(2)}</p>
            <p className="text-text text-xs m-0 mt-1">Contrast Ratio</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-text uppercase m-0">Normal Text</p>
            <ResultBadge pass={levels.aaNormal} label="AA (4.5:1 minimum)" />
            <ResultBadge pass={levels.aaaNormal} label="AAA (7:1 minimum)" />

            <p className="text-[11px] font-semibold tracking-[0.08em] text-text uppercase m-0 mt-2">Large Text (18pt+ / 14pt bold+)</p>
            <ResultBadge pass={levels.aaLarge} label="AA (3:1 minimum)" />
            <ResultBadge pass={levels.aaaLarge} label="AAA (4.5:1 minimum)" />
          </div>

          <div className="mt-4 p-3 bg-accentBg border border-accentBorder rounded-xl text-xs text-text">
            <span className="text-accent font-semibold">Tip:</span> Swap the colors to ensure it always finds a compliant color.
          </div>
        </div>
      </div>

      {/* WCAG Compliance Information Section */}
      <div className="mt-6 space-y-4">
        {/* AA vs AAA Explanation */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <Info size={20} className="text-accent shrink-0" />
            <h3 className="text-sm font-semibold text-textHeader m-0">WCAG 2.1 Accessibility Standards</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AA Standard */}
            <div className="border border-borderColor rounded-xl p-4 bg-accentBg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-base font-bold text-green-400">Level AA</h4>
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">Minimum Requirement</span>
              </div>
              <p className="text-text text-sm mb-3">The legal standard for most websites. Required for WCAG 2.1 compliance and ADA compliance.</p>
              <div className="space-y-2 text-xs text-text">
                <div className="flex justify-between">
                  <span>Normal Text (under 18pt):</span>
                  <span className="text-green-400 font-medium">4.5:1 ratio</span>
                </div>
                <div className="flex justify-between">
                  <span>Large Text (18pt+ or 14pt bold+):</span>
                  <span className="text-green-400 font-medium">3:1 ratio</span>
                </div>
                <div className="flex justify-between">
                  <span>User Interface Components:</span>
                  <span className="text-green-400 font-medium">3:1 ratio</span>
                </div>
              </div>
            </div>

            {/* AAA Standard */}
            <div className="border border-borderColor rounded-xl p-4 bg-accentBg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-base font-bold text-accent">Level AAA</h4>
                <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">Enhanced Standard</span>
              </div>
              <p className="text-text text-sm mb-3">The highest level of accessibility, recommended for specific audiences (elderly, low vision users).</p>
              <div className="space-y-2 text-xs text-text">
                <div className="flex justify-between">
                  <span>Normal Text (under 18pt):</span>
                  <span className="text-accent font-medium">7:1 ratio</span>
                </div>
                <div className="flex justify-between">
                  <span>Large Text (18pt+ or 14pt bold+):</span>
                  <span className="text-accent font-medium">4.5:1 ratio</span>
                </div>
                <div className="flex justify-between">
                  <span>User Interface Components:</span>
                  <span className="text-accent font-medium">3:1 ratio</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional WCAG Information */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <Info size={20} className="text-accent shrink-0" />
            <h3 className="text-sm font-semibold text-textHeader m-0">Understanding WCAG Contrast Requirements</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-text">
            <div className="space-y-2">
              <div className="font-semibold text-accent">Why Contrast Matters</div>
              <p>Proper contrast ensures content is perceivable by users with visual impairments, including low vision, color blindness, and age-related vision loss.</p>
            </div>
            
            <div className="space-y-2">
              <div className="font-semibold text-accent">Exceptions to Requirements</div>
              <p>• Logos and brand names<br/>• Decorative elements<br/>• Inactive interface components<br/>• Incidental text in images</p>
            </div>
            
            <div className="space-y-2">
              <div className="font-semibold text-accent">How to Use This Tool</div>
              <p>1. Enter or pick your colors<br/>2. Check if they meet AA/AAA standards<br/>3. Click "Fix to AA/AAA" to auto-adjust<br/>4. Verify with live preview</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}