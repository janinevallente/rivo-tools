# Rivo

A growing collection of fast, privacy-first tech utilities that run entirely in your browser. No installs, no server uploads — just tools that work instantly. Built with **React 19** and **Vite**.

---

## Features

- **24 tools across 7 categories** — image & asset tools, color utilities, Tailwind CSS helpers, network diagnostics, web performance auditing, security utilities, and quick references
- **Privacy-first, local-first** — most tools process everything on-device; nothing you feed them ever leaves your machine
- **Direct-to-API network tools** — DNS, WHOIS, IP, and PageSpeed Insights lookups talk straight from your browser to the relevant public API, so requests never pass through Rivo's own servers
- **On-device ML background removal** — client-side image segmentation via ONNX Runtime Web, no image ever uploaded anywhere
- **DNS-over-HTTPS lookups** — queries Cloudflare's public DoH resolver directly for A, AAAA, CNAME, MX, NS, TXT, SOA, PTR, SRV, CAA, DS, and DNSKEY records
- **RDAP-based WHOIS** — domain and IP registration lookups via RDAP, rendered as a full plain-text dump, with registry-specific extensions surfaced for `.sg` (Verified ID status) and `.au` (auDA eligibility/status reason data), and a direct link to the registry's own WHOIS page for ccTLDs RDAP doesn't cover
- **Cross-tool result caching** — DNS Lookup and WHOIS Lookup persist their last query's result to `localStorage`, so switching between them (or reloading) restores what you were looking at instead of forcing a re-query
- **Lighthouse-powered auditing** — PageSpeed Insights and Framework Detector both run real Lighthouse audits against a target URL for accurate, JS-aware results
- **Interactive color tools** — color wheel with harmony exploration, palette extraction from images, WCAG contrast auto-fixing, and conversion across HEX/RGB/HSL/LAB/LCH/OKLAB/OKLCH
- **Tailwind CSS toolset** — bidirectional Tailwind ⇄ CSS conversion, visual grid/flexbox/shadow builders, and a searchable utility class cheat sheet
- **Cryptographic utilities** — `window.crypto`-based password generation, MD5/SHA/RIPEMD hashing, and AES/DES/RC4/Rabbit symmetric encryption
- **Dark/light theme** — persisted per-device, defaults to dark unless the OS explicitly prefers light
- **Responsive design** — works on mobile, tablet, and desktop

---

## Tech Stack

| Layer           | Technology                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Framework       | [Vite](https://vite.dev) + [React 19](https://react.dev)                                                                   |
| Styling         | [Tailwind CSS v3](https://tailwindcss.com)                                                                                 |
| UI Components   | [Ant Design](https://ant.design)                                                                                           |
| Icons           | [Lucide React](https://lucide.dev)                                                                                         |
| Maps            | [Leaflet](https://leafletjs.com) / [React Leaflet](https://react-leaflet.js.org)                                           |
| ML (in-browser) | [ONNX Runtime Web](https://onnxruntime.ai) via [@imgly/background-removal](https://github.com/imgly/background-removal-js) |
| Crypto          | [crypto-js](https://github.com/brix/crypto-js), Web Crypto API                                                             |
| HTTP            | [Axios](https://axios-http.com)                                                                                            |
| Utilities       | [JSZip](https://stuk.github.io/jszip/)                                                                                     |
| Fonts           | Poppins via Google Fonts                                                                                                   |
| Deployment      | [Netlify](https://netlify.com)                                                                                             |

---

## Project Structure

```
src/
├── api/
│   └── apiClient.js                 # Shared GET helpers (generic, DNS-over-HTTPS, RDAP)
├── App.jsx / main.jsx                # Root app shell, routing, and lazy-loaded pages
├── components/
│   ├── themes/
│   │   ├── ThemeContext.jsx          # Dark/light theme state + localStorage persistence
│   │   └── AntThemeProvider.jsx      # Wires the theme into Ant Design's token system
│   └── ui/
│       ├── PageHeader.jsx            # Shared page title/description header
│       ├── Sidebar.jsx               # Collapsible nav grouped by tool category
│       └── IpLookupMap.jsx           # Leaflet map used by the IP Lookup tool
├── data/
│   ├── toolsData.js                  # Tool catalog — id, icon, label, description
│   ├── frameworkSignatures.js        # DNS/asset fingerprints for Framework Detector
│   └── TailwindCheatSheetData.js     # Reference data for the Tailwind cheat sheet
├── utils/
│   ├── colorUtils.js                 # Color space conversions (HEX/RGB/HSL/LAB/OKLCH...)
│   ├── passwordUtils.js              # Cryptographically random password generation
│   ├── pageSpeedUtils.js             # PageSpeed Insights request building + response parsing
│   └── toolResultCache.js            # Generic localStorage cache so tools can restore their last result across navigation
└── pages/                            # One component per tool (see Available Tools below)
```

---

## Getting Started

### Prerequisites

- Node.js **20+**
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/janinevallente/rivo-tools.git
cd rivo-tools

# Install dependencies
npm install
```

### Environment Variables

Only the **PageSpeed Insights** and **Framework Detector** tools need configuration — everything else works out of the box with no keys. Create a `.env` file in the project root:

```bash
VITE_PAGESPEED_API=https://www.googleapis.com/pagespeedonline/v5/runPagespeed
VITE_PAGESPEED_API_KEY=your_google_pagespeed_api_key
```

Get a free key from the [Google Cloud Console](https://console.cloud.google.com) by enabling the PageSpeed Insights API.

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## Available Tools

### Image & Assets

| Tool               | Description                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Background Remover | Removes backgrounds from images on-device via ONNX Runtime Web. Exports as transparent PNG.      |
| Image Converter    | Converts between PNG, JPEG, WebP, BMP, TIFF, and AVIF, with batch processing and resize options. |
| Image Clipper      | Automatically trims transparent edges from PNG images.                                           |
| Circle Cropper     | Crops any image into a circle with a draggable, resizable overlay.                               |
| Favicon Generator  | Generates favicons from 16×16 to 512×512, plus `.ico`, Apple Touch, Android, and PWA icons.      |

### Colors

| Tool               | Description                                                                             |
| ------------------ | --------------------------------------------------------------------------------------- |
| Pixel Picker       | Picks colors from any image — outputs HEX, RGB, HSL, and OKLCH.                         |
| Color Converter    | Real-time conversion across HEX, RGB, HSL, LAB, LCH, OKLAB, and OKLCH.                  |
| Color Wheel        | Interactive wheel for exploring analogous, complementary, triadic, and other harmonies. |
| Contrast Checker   | Checks WCAG 2.1 contrast compliance and can auto-fix colors to meet AA/AAA.             |
| Gradient Generator | Builds multi-stop CSS gradients, exportable as code.                                    |
| Palette Extractor  | Extracts dominant color palettes from any image.                                        |

### Tailwind

| Tool                       | Description                                                                      |
| -------------------------- | -------------------------------------------------------------------------------- |
| Tailwind to CSS Converter  | Converts Tailwind utility strings to raw CSS, and parses CSS back into Tailwind. |
| Tailwind Grid Generator    | Visual builder for responsive CSS grid layouts.                                  |
| Tailwind Flexbox Generator | Interactive flex container/alignment/direction builder.                          |
| Tailwind Shadow Generator  | Builds layered box/inline shadows for Tailwind v3 and v4.                        |

### Network

| Tool              | Description                                                                                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IP Address Lookup | Your public IP, ISP, and geolocation, with an interactive map.                                                                                                                                                                                                                                    |
| DNS Lookup        | Queries A, AAAA, CNAME, MX, NS, TXT, SOA, PTR, SRV, CAA, DS, and DNSKEY records via DNS-over-HTTPS. Last result persists across tool switches.                                                                                                                                                    |
| WHOIS Lookup      | Domain/IP registration data via RDAP, rendered as a full plain-text dump. Surfaces `.sg` Verified ID status and `.au` auDA eligibility/status-reason fields where present, and links to the registry's own WHOIS page for ccTLDs without RDAP support. Last result persists across tool switches. |

### Web & Performance

| Tool               | Description                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PageSpeed Insights | Full Lighthouse + CrUX audit — performance, accessibility, best practices, SEO.                                                                                         |
| Framework Detector | Identifies the hosting platform, frontend framework, and deployment stack behind any site via DNS and asset fingerprinting, plus Lighthouse's own stack-pack detection. |

### Security

| Tool               | Description                                                    |
| ------------------ | -------------------------------------------------------------- |
| Password Generator | Cryptographically random passwords via `window.crypto`.        |
| Hash Generator     | MD5, SHA-1, SHA-256, SHA-512, SHA-3, and RIPEMD-160 from text. |
| Symmetric Cipher   | Encrypt/decrypt with AES, DES, Triple DES, RC4, or Rabbit.     |

### Reference

| Tool                     | Description                                                                  |
| ------------------------ | ---------------------------------------------------------------------------- |
| Tailwind CSS Cheat Sheet | Searchable reference for Tailwind utility classes and their CSS equivalents. |

---

## Adding a New Tool

Every tool is registered in three places:

1. **`src/data/toolsData.js`** — add an entry with `id`, `icon`, `label`, and `description`. This drives the home page grid and search.
2. **`src/components/ui/Sidebar.jsx`** — add the same `id`/`label`/`icon` under the relevant category so it shows up in the nav.
3. **`src/App.jsx`** — lazy-import the page component and add a `case '<id>': return <YourTool />` to the router switch.

The tool itself lives in `src/pages/YourTool.jsx` as a self-contained component (no shared state beyond what it fetches or computes itself).

### Persisting a Tool's Results

If a tool's result should survive the user navigating to another tool and back (like DNS Lookup and WHOIS Lookup do), wire it up to `src/utils/toolResultCache.js`:

1. Add a unique id for the tool to `TOOL_CACHE_KEYS`.
2. After a successful query, call `saveToolCache(TOOL_CACHE_KEYS.YOUR_TOOL, { ...whatever state should be restored })`. Treat failures as a result too — call `saveToolCache` in the error path as well (with the data fields nulled out and an `error` message included) so a tool switch and back reflects the last _outcome_, not a stale success.
3. In a `useEffect` on mount, call `loadToolCache(TOOL_CACHE_KEYS.YOUR_TOOL)` and, if it returns non-null, use it to hydrate initial state.
4. Optionally call `clearToolCache(TOOL_CACHE_KEYS.YOUR_TOOL)` if the tool has a "clear results" action.

Cached data is versioned internally, so a shape change to what you save won't break on old cached entries — they're just ignored. Everything is wrapped in try/catch and no-ops on failure (private browsing, storage quota, etc.), so it's safe to add without extra error handling on the caller's side.

---

## Deployment

This project is deployed on [Netlify](https://netlify.com). To deploy your own fork:

1. Push the repository to GitHub
2. Import the project on [netlify.com](https://netlify.com)
3. Netlify auto-detects Vite — build command `npm run build`, publish directory `dist`
4. Add `VITE_PAGESPEED_API` and `VITE_PAGESPEED_API_KEY` under Site settings → Environment variables if you want the PageSpeed/Framework Detector tools enabled
5. Every push to `main` triggers a new deployment automatically

---

## Acknowledgements

- Background removal powered by [@imgly/background-removal](https://github.com/imgly/background-removal-js) and [ONNX Runtime Web](https://onnxruntime.ai)
- DNS lookups via [Cloudflare DNS-over-HTTPS](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/)
- WHOIS data via [RDAP](https://rdap.org)
- IP geolocation via [ipinfo.io](https://ipinfo.io)
- Performance audits via [Google PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/get-started)
- Icons from [Lucide](https://lucide.dev)
- Deployed and hosted on [Netlify](https://netlify.com)

---

_Built by Janine Vallente._
