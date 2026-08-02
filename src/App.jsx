import { useState, useEffect, Suspense, lazy } from 'react'
import { SyncLoader } from 'react-spinners'
import Sidebar from './components/ui/Sidebar'
import AntThemeProvider from './components/themes/AntThemeProvider'
import Home from './pages/Home'
import './index.css'

const BackgroundRemover = lazy(() => import('./pages/BackgroundRemover'))
const ImageClipper = lazy(() => import('./pages/ImageClipper'))
const CircleCropper = lazy(() => import('./pages/CircleCropper'))
const ImageConverter = lazy(() => import('./pages/ImageConverter'))
const FaviconGenerator = lazy(() => import('./pages/FaviconGenerator'))
const PixelPicker = lazy(() => import('./pages/PixelPicker'))
const ColorWheel = lazy(() => import('./pages/ColorWheel'))
const ColorConverter = lazy(() => import('./pages/ColorConverter'))
const ContrastChecker = lazy(() => import('./pages/ContrastChecker'))
const GradientGenerator = lazy(() => import('./pages/GradientGenerator'))
const PaletteExtractor = lazy(() => import('./pages/PaletteExtractor'))
const TailwindCssConverter = lazy(() => import('./pages/TailwindCssConverter'))
const TailwindGridGenerator = lazy(() => import('./pages/TailwindGridGenerator'))
const TailwindFlexboxGenerator = lazy(() => import('./pages/TailwindFlexboxGenerator'))
const TailwindShadowGenerator = lazy(() => import('./pages/TailwindShadowGenerator'))
const IpLookup = lazy(() => import('./pages/IpLookup'))
const DnsLookup = lazy(() => import('./pages/DnsLookup'))
const WhoisLookup = lazy(() => import('./pages/WhoisLookup'))
const PageSpeedInsights = lazy(() => import('./pages/PageSpeedInsights'))
const FrameworkDetector = lazy(() => import('./pages/FrameworkDetector'))
const PasswordGenerator = lazy(() => import('./pages/PasswordGenerator'))
const HashGenerator = lazy(() => import('./pages/HashGenerator'))
const SymmetricCipher = lazy(() => import('./pages/SymmetricCipher'))
const TailwindCheatSheet = lazy(() => import('./pages/TailwindCheatSheet'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <SyncLoader color="#3B5BDB" size={13} />
    </div>
  )
}

function App() {
  // Read initial route state from URL string layout on boot
  const [activeTool, setActiveTool] = useState(() => {
    return window.location.hash.replace('#', '') || null
  })

  // Watch for programmatic back/forward popstate actions or modifications
  useEffect(() => {
    const handleHashChange = () => {
      setActiveTool(window.location.hash.replace('#', '') || null)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Wrapped dispatcher to mutate path addresses dynamically
  const navigateTo = (toolId) => {
    window.location.hash = toolId || ''
  }

  const renderPage = () => {
    switch (activeTool) {
      case 'bg-remover': return <BackgroundRemover />
      case 'image-clipper': return <ImageClipper />
      case 'circle-cropper': return <CircleCropper />
      case 'image-converter': return <ImageConverter />
      case 'favicon-generator': return <FaviconGenerator />
      case 'pixel-picker': return <PixelPicker />
      case 'color-wheel': return <ColorWheel />
      case 'color-converter': return <ColorConverter />
      case 'contrast-checker': return <ContrastChecker />
      case 'gradient-generator': return <GradientGenerator />
      case 'palette-extractor': return <PaletteExtractor />
      case 'tailwind-css-converter': return <TailwindCssConverter />
      case 'tailwind-grid-generator': return <TailwindGridGenerator />
      case 'tailwind-flexbox-generator': return <TailwindFlexboxGenerator />
      case 'tailwind-shadow-generator': return <TailwindShadowGenerator />
      case 'ip-lookup': return <IpLookup />
      case 'dns-lookup': return <DnsLookup />
      case 'whois-lookup': return <WhoisLookup />
      case 'password-generator': return <PasswordGenerator />
      case 'pagespeed-insights': return <PageSpeedInsights />
      case 'framework-detector': return <FrameworkDetector />
      case 'hash-generator': return <HashGenerator />
      case 'symmetric-cipher': return <SymmetricCipher />
      case 'tailwind-cheat-sheet': return <TailwindCheatSheet />
      

      default: return <Home onSelectTool={navigateTo} />
    }
  }

  return (
    <AntThemeProvider>
      <div className="flex min-h-screen bg-backgroundColor">
        <Sidebar activeTool={activeTool} onSelectTool={navigateTo} />
        <div className="flex flex-col flex-1 min-w-0 pt-14 lg:pt-0">
          <main className="flex-1">
            <Suspense fallback={<PageLoader />}>
              {renderPage()}
            </Suspense>
          </main>
        </div>
      </div>
    </AntThemeProvider>
  )
}

export default App