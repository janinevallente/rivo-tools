import { useState } from 'react'
import { Tooltip } from 'antd'
import { 
  Layers,  
  ChevronLeft, 
  Menu, 
  X,
  House,
  Eraser, 
  ImageIcon, 
  Scissors,
  CircleDashed,
  Pipette,
  LifeBuoy,
  Palette,
  Contrast,
  Blend,
  ArrowLeftRight,
  Grid,
  Columns,
  BoxSelect,
  Waves,
  MapPin,
  Globe,
  ScrollText,
  KeyRound,
  Hash,
  Lock,
  Sun,
  Moon,
  Star,
  Gauge,
  Fingerprint,
  Cpu
} from 'lucide-react'
import { useTheme } from '../themes/ThemeContext'

const VERSION = __APP_VERSION__

const categories = [
  {
    label: 'Image & Assets',
    tools: [
      { id: 'bg-remover', label: 'Background Remover', icon: Eraser },
      { id: 'image-converter', label: 'Image Converter', icon: ImageIcon },
      { id: 'image-clipper', label: 'Image Clipper', icon: Scissors },
      { id: 'circle-cropper', label: 'Circle Cropper', icon: CircleDashed },
      { id: 'favicon-generator', label: 'Favicon Generator', icon: Star },
    ],
  },
  {
    label: 'Colors',
    tools: [
      { id: 'pixel-picker', label: 'Pixel Picker', icon: Pipette },
      { id: 'color-wheel', label: 'Color Wheel', icon: LifeBuoy },
      { id: 'color-converter', label: 'Color Converter', icon: Palette },
      { id: 'contrast-checker', label: 'Contrast Checker', icon: Contrast },
      { id: 'gradient-generator', label: 'Gradient Generator', icon: Blend },
      { id: 'palette-extractor', label: 'Palette Extractor', icon: ImageIcon },
    ],
  },
    {
    label: 'Tailwind',
    tools: [
      { id: 'tailwind-css-converter', label: 'Tailwind to CSS Converter', icon: ArrowLeftRight },
      { id: 'tailwind-grid-generator', label: 'Tailwind Grid Generator', icon: Grid },
      { id: 'tailwind-flexbox-generator', label: 'Tailwind Flexbox Generator', icon: Columns },
      { id: 'tailwind-shadow-generator', label: 'Tailwind Shadow Generator', icon: BoxSelect },
    ],
  },
  {
    label: 'Network',
    tools: [
      { id: 'ip-lookup', label: 'IP Address Lookup', icon: MapPin },
      { id: 'dns-lookup', label: 'DNS Lookup', icon: Globe },
      { id: 'whois-lookup', label: 'WHOIS Lookup', icon: ScrollText },
      { id: 'pagespeed-insights', label: 'PageSpeed Insights', icon: Gauge },
      { id: 'framework-detector', label: 'Framework Detector', icon: Cpu },
    ],
  },
  {
    label: 'Security',
    tools: [
      { id: 'password-generator', label: 'Password Generator', icon: KeyRound },
      { id: 'hash-generator', label: 'Hash Generator', icon: Hash },
      { id: 'symmetric-cipher', label: 'Symmetric Cipher', icon: Lock },
    ],
  },
  {
    label: 'Reference',
    tools: [
      { id: 'tailwind-cheat-sheet', label: 'Tailwind CSS Cheat Sheet', icon: Waves },
    ],
  },
]

export default function Sidebar({ activeTool, onSelectTool }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { themeMode, toggleTheme } = useTheme()

  const handleSelect = (id) => {
    onSelectTool(id)
    setMobileOpen(false)
  }

  const NavItem = ({ id, label, icon: Icon }) => {
    const active = activeTool === id

    const btn = (
      <button
        onClick={() => handleSelect(id)}
        className={`flex items-center gap-2.5 rounded-lg border-l-2 border-t-0 border-r-0 border-b-0 cursor-pointer text-sm w-full text-left transition-colors
          ${collapsed ? 'px-[10px] py-2.5 justify-center' : 'px-3 py-2'}
          ${active
            ? 'bg-accentBg text-accent border-l-accent font-medium'
            : 'bg-transparent text-text border-l-transparent font-normal hover:bg-accentBg hover:text-accent'
          }`}
      >
        <Icon size={16} className="shrink-0" />
        {!collapsed && <span className="whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>}
      </button>
    )

    if (collapsed) {
      return (
        <Tooltip title={label} placement="right">
          {btn}
        </Tooltip>
      )
    }

    return btn
  }

  return (
    <>
      {/* Mobile navbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-backgroundCard border-b border-borderColor">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={() => handleSelect(null)}
            className="flex items-center gap-2 font-semibold text-base text-textHeader bg-transparent border-none cursor-pointer p-0"
          >
            <span className="bg-accent rounded-lg w-7 h-7 flex items-center justify-center shrink-0">
              <Layers size={15} color="white" />
            </span>
            Byteflow
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="bg-transparent border-none cursor-pointer text-text p-1.5 rounded-lg hover:bg-accentBg hover:text-accent transition-colors"
              aria-label="Toggle color theme"
              title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {themeMode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="bg-transparent border-none cursor-pointer text-text p-1.5 rounded-lg hover:bg-accentBg hover:text-accent transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="flex flex-col px-3 pb-3 max-h-[70vh] overflow-y-auto scrollbar-hide bg-backgroundCard">
            {/* Home Item */}
            <button
              onClick={() => handleSelect(null)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium w-full text-left border-none cursor-pointer transition-colors ${
                activeTool === null
                  ? 'bg-accentBg text-accent'
                  : 'bg-transparent text-text hover:bg-accentBg hover:text-accent'
              }`}
            >
              <House size={16} />
              Home
            </button>

            {categories.map(({ label, tools }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold tracking-[0.08em] text-text uppercase px-2 pt-3 pb-1 m-0">
                  {label}
                </p>
                {tools.map(({ id, label: toolLabel, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleSelect(id)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium w-full text-left border-none cursor-pointer transition-colors
                      ${activeTool === id
                        ? 'bg-accentBg text-accent'
                        : 'bg-transparent text-text hover:bg-accentBg hover:text-accent'
                      }`}
                  >
                    <Icon size={16} />
                    {toolLabel}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 bg-backgroundCard border-r border-borderColor h-screen sticky top-0 overflow-hidden transition-all duration-200 ${collapsed ? 'w-16' : 'w-[225px]'}`}
      >
        {/* Logo — click to toggle collapse */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`h-[60px] w-full flex items-center border-b border-borderColor shrink-0 gap-2.5 bg-transparent border-t-0 border-l-0 border-r-0 cursor-pointer hover:bg-accentBg transition-colors group
            ${collapsed ? 'px-[17px] justify-center' : 'px-4'}`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="bg-accent rounded-lg w-[30px] h-[30px] flex items-center justify-center shrink-0">
            <Layers size={16} color="white" />
          </span>
          {!collapsed && (
            <div className="flex flex-col items-start leading-none">
              <span className="text-textHeader font-semibold text-[15px] whitespace-nowrap">Byteflow</span>
            </div>
          )}
        </button>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 flex flex-col gap-0.5 overflow-y-auto scrollbar-hide">
          {/* Home — no category label */}
          <div className="mb-2">
            <NavItem id={null} label="Home" icon={House} />
          </div>

          {categories.map(({ label, tools }) => (
            <div key={label} className="mb-2">
              {!collapsed && (
                <p className="text-[10px] font-semibold tracking-[0.08em] text-text uppercase px-2 pt-2 pb-1 m-0">
                  {label}
                </p>
              )}
              {collapsed && <div className="border-t border-borderColor my-2" />}
              {tools.map(tool => (
                <NavItem key={tool.id} {...tool} />
              ))}
            </div>
          ))}
        </nav>

        {/* Theme toggle */}
        <div className={`border-t border-borderColor flex ${collapsed ? 'justify-center py-2' : 'px-2 py-2'}`}>
          {collapsed ? (
            <Tooltip title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} placement="right">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center px-[10px] py-2.5 rounded-lg border-none bg-transparent text-text cursor-pointer hover:bg-accentBg hover:text-accent transition-colors w-full"
                aria-label="Toggle color theme"
              >
                {themeMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border-none bg-transparent text-text text-sm cursor-pointer hover:bg-accentBg hover:text-accent transition-colors w-full text-left"
            >
              {themeMode === 'dark' ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
              {themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          )}
        </div>

        {/* Version */}
        <div className={`border-t border-borderColor flex items-center ${collapsed ? 'justify-center py-3' : 'px-4 py-3'}`}>
          <span className="text-[11px] text-text">
            {collapsed ? `v${VERSION}` : `Version ${VERSION}`}
          </span>
        </div>
      </aside>
    </>
  )
}