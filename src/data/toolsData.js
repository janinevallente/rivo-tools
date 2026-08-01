import { 
  Eraser,
  Scissors,
  CircleDashed, 
  ImageIcon, 
  Pipette,
  Palette,
  Contrast,
  Blend,
  LifeBuoy,
  Waves,
  ArrowLeftRight,
  Grid,
  Columns,
  BoxSelect,
  MapPin,
  Globe,
  KeyRound,
  Hash,
  Lock,
  ScrollText,
  Star,
  Gauge,
  Fingerprint,
  Cpu
} from 'lucide-react'

export const tools = [
  // Image & Assets Category
  {
    id: 'bg-remover',
    icon: Eraser,
    label: 'Background Remover',
    description: 'Remove backgrounds from images instantly using edge detection. Export as transparent PNG.',
  },
  {
    id: 'image-converter',
    icon: ImageIcon,
    label: 'Image Converter',
    description: 'Convert between PNG, JPEG, WebP, BMP, TIFF, AVIF. Batch processing with resize options.',
  },
  {
    id: 'image-clipper',
    icon: Scissors,
    label: 'Image Clipper',
    description: 'Automatically trim transparent edges from PNG images. Perfect for icons, logos, and illustrations.',
  },
  {
    id: 'circle-cropper',
    icon: CircleDashed,
    label: 'Circle Cropper',
    description: 'Crop any image into a perfect circle. Drag & resize the circle overlay, then export as transparent PNG.',
  },
  {
    id: 'favicon-generator',
    icon: Star,
    label: 'Favicon Generator',
    description: 'Generate favicons in all standard sizes (16×16 to 512×512) plus .ico, Apple Touch, Android, and PWA icons.',
  },
  
  // Colors Category
  {
    id: 'pixel-picker',
    icon: Pipette,
    label: 'Pixel Picker',
    description: 'Pick colors from any image. Get HEX, RGB, HSL, and OKLCH values.',
  },
  {
    id: 'color-converter',
    icon: Palette,
    label: 'Color Converter',
    description: 'Convert between HEX, RGB, HSL, LAB, LCH, OKLAB, and OKLCH color formats. Real-time conversion.',
  },
  {
    id: 'color-wheel',
    icon: LifeBuoy,
    label: 'Color Wheel',
    description: 'Pick a base color from an interactive color wheel and explore analogous, complementary, triadic, and other harmonies.',
  },
  {
    id: 'contrast-checker',
    icon: Contrast,
    label: 'Contrast Checker',
    description: 'Check WCAG 2.1 color contrast compliance. Automatically fix colors to meet AA or AAA standards.',
  },
  {
    id: 'gradient-generator',
    icon: Blend,
    label: 'Gradient Generator',
    description: 'Create beautiful CSS gradients with multiple color stops. Export as CSS code or copy to clipboard.',
  },
  {
    id: 'palette-extractor',
    icon: ImageIcon,
    label: 'Palette Extractor',
    description: 'Extract color palettes from any image. Get dominant colors and generate harmonious schemes.',
  },

  // Tailwind Utilities Category
  {
    id: 'tailwind-to-css',
    icon: ArrowLeftRight,
    label: 'Tailwind to CSS Converter',
    description: 'Convert Tailwind utility class strings into raw CSS code blocks, or backward-parse standard CSS rules back into Tailwind equivalents.',
  },
  {
    id: 'tailwind-grid-generator',
    icon: Grid,
    label: 'Tailwind Grid Generator',
    description: 'Visually layout custom responsive grid patterns, adapt fraction dimensions or gaps, and export structural utility rows.',
  },
  {
    id: 'tailwind-flexbox-generator',
    icon: Columns,
    label: 'Tailwind Flexbox Generator',
    description: 'Configure and balance flex container positions, alignment dynamics, wrapper directions, and layouts interactively.',
  },
  {
    id: 'tailwind-shadow-generator',
    icon: BoxSelect,
    label: 'Tailwind Shadow Generator',
    description: 'Build complex custom layered inline or box-shadow modifiers targeting both Tailwind CSS v3 and v4 syntax parameters.',
  },
  
  // Network
  {
    id: 'ip-lookup',
    icon: MapPin,
    label: 'IP Address Lookup',
    description: 'Instantly view configuration details, ISP, and geological metrics for your current public IP address alongside an interactive location map.',
  },
    {
    id: 'dns-lookup',
    icon: Globe,
    label: 'DNS Lookup',
    description: 'Query A, AAAA, CNAME, MX, NS, TXT, SOA, PTR, SRV, CAA, DS, and DNSKEY records for any domain via DNS-over-HTTPS.',
  },
  {
    id: 'whois-lookup',
    icon: ScrollText,
    label: 'WHOIS Lookup',
    description: 'Look up domain registration data via RDAP — domain info, registrar, and registrant contact.',
  },
    {
    id: 'pagespeed-insights',
    icon: Gauge,
    label: 'PageSpeed Insights',
    description: 'Full Lighthouse + CrUX field data audit: performance, accessibility, best practices, and SEO with opportunities, diagnostics, and resource breakdowns.',
  },
  {
    id: 'framework-detector',
    icon: Cpu,
    label: 'Framework Detector',
    description: 'Instantly detect the hosting platform, JS framework, CDN, and deployment stack behind any website using automated DNS and script fingerprinting.',
  },

  // Security
  {
    id: 'password-generator',
    icon: KeyRound,
    label: 'Password Generator',
    description: 'Generate strong, random passwords using window.crypto for true cryptographic randomness.',
  },
  {
    id: 'hash-generator',
    icon: Hash,
    label: 'Hash Generator',
    description: 'Generate MD5, SHA-1, SHA-256, SHA-512, SHA-3, and RIPEMD-160 hashes from text.',
  },
  {
    id: 'symmetric-cipher',
    icon: Lock,
    label: 'Symmetric Cipher',
    description: 'Symmetric encryption and decryption using AES, DES, Triple DES, RC4, or Rabbit.',
  },

  // Reference
  {
    id: 'tailwind-cheat-sheet',
    icon: Waves,
    label: 'Tailwind CSS Cheat Sheet',
    description: 'A quick reference for Tailwind CSS utility classes, their CSS equivalents, and sample usage.',
  },
]