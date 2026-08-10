import { useState, useCallback, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { Copy, Check } from 'lucide-react'
import { Select } from 'antd'
import PageHeader from '../components/ui/PageHeader'
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  rgbToLab,
  labToRgb,
  rgbToLch,
  lchToRgb,
  rgbToOklab,
  oklabToRgb,
  rgbToOklch,
  oklchToRgb,
  getAllFormats,
  clamp,
} from '../utils/colorUtils'

const INPUT_FORMATS = [
  { id: 'HEX', label: 'HEX', placeholder: '#3b82f6' },
  { id: 'RGB', label: 'RGB', placeholder: '59, 130, 246' },
  { id: 'Decimal RGB', label: 'Decimal RGB', placeholder: '0.2314, 0.5098, 0.9647' },
  { id: 'HSL', label: 'HSL', placeholder: '217, 91%, 60%' },
  { id: 'LAB', label: 'LAB', placeholder: '55.63, 17.54, -64.42' },
  { id: 'LCH', label: 'LCH', placeholder: '55.63, 66.77, 285.2' },
  { id: 'OKLAB', label: 'OKLAB', placeholder: '0.6231, -0.0332, -0.1851' },
  { id: 'OKLCH', label: 'OKLCH', placeholder: '0.6231, 0.1880, 259.8' },
]

const DEFAULT_RGB = { r: 59, g: 130, b: 246 }

// Parses raw input text (in the given format) into an {r,g,b} object, or null if invalid
function parseInput(format, text) {
  const cleaned = text.replace(/[a-z%()]/gi, '').trim()
  const nums = cleaned.split(',').map(s => parseFloat(s.trim()))

  switch (format) {
    case 'HEX':
      return hexToRgb(text)
    case 'RGB': {
      if (nums.length !== 3 || nums.some(Number.isNaN)) return null
      return { r: clamp(nums[0], 0, 255), g: clamp(nums[1], 0, 255), b: clamp(nums[2], 0, 255) }
    }
    case 'Decimal RGB': {
      if (nums.length !== 3 || nums.some(Number.isNaN)) return null
      return {
        r: clamp(nums[0] * 255, 0, 255),
        g: clamp(nums[1] * 255, 0, 255),
        b: clamp(nums[2] * 255, 0, 255),
      }
    }
    case 'HSL': {
      if (nums.length !== 3 || nums.some(Number.isNaN)) return null
      return hslToRgb(nums[0], nums[1], nums[2])
    }
    case 'LAB': {
      if (nums.length !== 3 || nums.some(Number.isNaN)) return null
      return labToRgb(nums[0], nums[1], nums[2])
    }
    case 'LCH': {
      if (nums.length !== 3 || nums.some(Number.isNaN)) return null
      return lchToRgb(nums[0], nums[1], nums[2])
    }
    case 'OKLAB': {
      if (nums.length !== 3 || nums.some(Number.isNaN)) return null
      return oklabToRgb(nums[0], nums[1], nums[2])
    }
    case 'OKLCH': {
      if (nums.length !== 3 || nums.some(Number.isNaN)) return null
      return oklchToRgb(nums[0], nums[1], nums[2])
    }
    default:
      return null
  }
}

// Formats {r,g,b} as the default display string for a given input format,
// used to populate the Value field when switching formats.
function formatForInput(format, rgb) {
  const { r, g, b } = rgb
  switch (format) {
    case 'HEX': return rgbToHex(r, g, b)
    case 'RGB': return `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`
    case 'Decimal RGB':
      return `${(r / 255).toFixed(4)}, ${(g / 255).toFixed(4)}, ${(b / 255).toFixed(4)}`
    case 'HSL': {
      const { h, s, l } = rgbToHsl(r, g, b)
      return `${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%`
    }
    case 'LAB': {
      const lab = rgbToLab(r, g, b)
      return `${lab.l.toFixed(2)}, ${lab.a.toFixed(2)}, ${lab.b.toFixed(2)}`
    }
    case 'LCH': {
      const lch = rgbToLch(r, g, b)
      return `${lch.l.toFixed(2)}, ${lch.c.toFixed(2)}, ${lch.h.toFixed(1)}`
    }
    case 'OKLAB': {
      const ok = rgbToOklab(r, g, b)
      return `${ok.l.toFixed(4)}, ${ok.a.toFixed(4)}, ${ok.b.toFixed(4)}`
    }
    case 'OKLCH': {
      const ok = rgbToOklch(r, g, b)
      return `${ok.l.toFixed(4)}, ${ok.c.toFixed(4)}, ${ok.h.toFixed(1)}`
    }
    default: return ''
  }
}

export default function ColorConverter() {
  const [format, setFormat] = useState('HEX')
  const [value, setValue] = useState(rgbToHex(DEFAULT_RGB.r, DEFAULT_RGB.g, DEFAULT_RGB.b))
  const [copied, setCopied] = useState(null)

  const rgb = useMemo(() => {
    const parsed = parseInput(format, value)
    return parsed ? {
      r: clamp(parsed.r, 0, 255),
      g: clamp(parsed.g, 0, 255),
      b: clamp(parsed.b, 0, 255),
    } : null
  }, [format, value])

  const formats = useMemo(() => {
    if (!rgb) return null
    return getAllFormats(rgb.r, rgb.g, rgb.b)
  }, [rgb])

  const handleFormatChange = (newFormat) => {
    if (rgb) {
      setValue(formatForInput(newFormat, rgb))
    }
    setFormat(newFormat)
  }

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 1500)
  }, [])

  const currentFormatMeta = INPUT_FORMATS.find(f => f.id === format)

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Color Converter</title>
      </Helmet>
      <PageHeader
        title="Color Converter"
        description="Convert between color formats — HEX, RGB, decimal RGB, HSL, LAB, LCH, OKLAB, and OKLCH."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: preview + input - COMPACT VERSION */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-4">
          <div className="flex gap-3 items-center">
            {/* Color preview - much smaller */}
            <div
              className="aspect-square mt-4 rounded-2xl border border-borderColor shrink-0"
              style={{
                width: '7rem',
                height: '7rem',
                background: rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : 'transparent',
              }}
            />

            <div className="flex-1 flex flex-col gap-2 min-w-0">
              {/* Value input */}
              <div>
                <label className="text-[10px] font-semibold text-accent block mb-0.5">Value</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={currentFormatMeta?.placeholder}
                  className="w-full px-2 py-1.5 rounded-lg bg-backgroundColor border border-borderColor text-sm text-textHeader font-mono focus:outline-none focus:border-accent transition-colors"
                />
                {!rgb && (
                  <p className="text-[10px] text-red-500 mt-0.5 mb-0">Invalid value for {currentFormatMeta?.label} format.</p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-semibold text-accent block mb-0.5">Input Format</label>
                <Select
                  value={format}
                  onChange={handleFormatChange}
                  className="w-full"
                  popupMatchSelectWidth={false}
                  options={INPUT_FORMATS.map(f => ({ value: f.id, label: f.label }))}
                  showSearch
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: All Formats */}
        <div>
          <h2 className="text-sm font-semibold text-textHeader m-0 mb-3">All Formats</h2>
          <div className="flex flex-col gap-2">
            {formats ? (
              Object.entries(formats).map(([label, val]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-backgroundCard border border-borderColor">
                  <span className="text-[10px] font-semibold text-accent min-w-[90px] uppercase">{label}</span>
                  <span className="text-xs text-textHeader font-mono flex-1 truncate">{val}</span>
                  <button
                    onClick={() => copyToClipboard(val)}
                    className="text-text hover:text-accent transition-colors bg-transparent border-none cursor-pointer p-0.5 shrink-0"
                    title="Copy"
                  >
                    {copied === val ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                  </button>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 rounded-xl bg-backgroundCard border border-borderColor text-center text-text text-sm">
                Enter a valid {currentFormatMeta?.label} value to see all formats.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}