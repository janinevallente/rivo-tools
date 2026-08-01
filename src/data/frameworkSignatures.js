// Framework / platform fingerprint database.
//
// Two detection layers:
//   1. DNS (CNAME / A / NS) — for hosted platforms that route traffic
//      through their own infrastructure. Queried via DoH, no backend.
//   2. PSI / HTML — for JS frameworks, meta-frameworks, and libraries
//      that reveal themselves in page source, headers, or script URLs.
//      Mined from the Lighthouse network-requests audit and stackPacks.
//
// dns.rules[].type : 'cname' | 'a' | 'ns'
// psi.scriptPatterns : RegExp[] matched against JS resource URLs
// psi.htmlPatterns   : RegExp[] matched against raw HTML of the root document
// psi.stackPackId    : exact Lighthouse stackPacks[].id string

export const FRAMEWORK_CATEGORIES = {
  FRAMEWORK:  'JS Framework',
  META:       'Meta-framework',
  HOSTING:    'Hosting & Deployment',
  CDN:        'CDN & Edge',
  ECOMMERCE:  'Ecommerce',
  BUILDER:    'Website Builder',
  BACKEND:    'Backend-as-a-Service',
  CMS:        'Headless CMS',
  ANALYTICS:  'Analytics & Tag Manager',
}

export const frameworkSignatures = [

  // JS Frameworks

  {
    id: 'react',
    name: 'React',
    category: FRAMEWORK_CATEGORIES.FRAMEWORK,
    homepage: 'https://react.dev',
    color: '#61DAFB',
    description: 'The library for web and native user interfaces.',
    psi: {
      stackPackId: 'react',
      scriptPatterns: [/\/react(?:\.min)?\.js/, /\/react-dom(?:\.min)?\.js/, /react[@/]/],
      htmlPatterns:  [/data-reactroot/, /__REACT_/],
    },
  },
  {
    id: 'vue',
    name: 'Vue.js',
    category: FRAMEWORK_CATEGORIES.FRAMEWORK,
    homepage: 'https://vuejs.org',
    color: '#42B883',
    description: 'The progressive JavaScript framework.',
    psi: {
      stackPackId: 'vue',
      scriptPatterns: [/\/vue(?:\.min|\.esm)?\.js/, /vue[@/]/],
      htmlPatterns:  [/data-v-[a-f0-9]{6,}/, /__vue_app__/],
    },
  },
  {
    id: 'angular',
    name: 'Angular',
    category: FRAMEWORK_CATEGORIES.FRAMEWORK,
    homepage: 'https://angular.dev',
    color: '#DD0031',
    description: 'Platform for building mobile and desktop web apps.',
    psi: {
      stackPackId: 'angular',
      scriptPatterns: [/\/angular(?:\.min)?\.js/, /@angular\/core/],
      htmlPatterns:  [/ng-version=/, /_nghost-/, /_ngcontent-/],
    },
  },
  {
    id: 'svelte',
    name: 'Svelte',
    category: FRAMEWORK_CATEGORIES.FRAMEWORK,
    homepage: 'https://svelte.dev',
    color: '#FF3E00',
    description: 'Cybernetically enhanced web apps — compiled, no virtual DOM.',
    psi: {
      stackPackId: 'svelte',
      scriptPatterns: [/svelte[@/]/, /\.svelte\./],
      htmlPatterns:  [/svelte-[a-z0-9]{6,}/, /class="s-[a-zA-Z0-9_-]+"/],
    },
  },
  {
    id: 'preact',
    name: 'Preact',
    category: FRAMEWORK_CATEGORIES.FRAMEWORK,
    homepage: 'https://preactjs.com',
    color: '#673AB8',
    description: 'Fast 3kB React alternative with the same modern API.',
    psi: {
      scriptPatterns: [/\/preact(?:\.min)?\.js/, /preact[@/]/],
      htmlPatterns:  [/__PREACT_/],
    },
  },
  {
    id: 'solid',
    name: 'SolidJS',
    category: FRAMEWORK_CATEGORIES.FRAMEWORK,
    homepage: 'https://solidjs.com',
    color: '#2C4F7C',
    description: 'Simple and performant reactivity for building UIs.',
    psi: {
      scriptPatterns: [/solid-js[@/]/, /\/solid(?:\.min)?\.js/],
      htmlPatterns:  [/data-hk=/, /<!--\$-->/],
    },
  },
  {
    id: 'htmx',
    name: 'HTMX',
    category: FRAMEWORK_CATEGORIES.FRAMEWORK,
    homepage: 'https://htmx.org',
    color: '#3D72D7',
    description: 'High power tools for HTML — access AJAX directly in markup.',
    psi: {
      scriptPatterns: [/htmx(?:\.min)?\.js/, /unpkg\.com\/htmx/],
      htmlPatterns:  [/hx-get=|hx-post=|hx-boost=/],
    },
  },
  {
    id: 'alpine',
    name: 'Alpine.js',
    category: FRAMEWORK_CATEGORIES.FRAMEWORK,
    homepage: 'https://alpinejs.dev',
    color: '#77C1D2',
    description: 'Rugged, minimal JavaScript for composing behaviour in HTML.',
    psi: {
      scriptPatterns: [/alpinejs[@/]/, /alpine(?:\.min)?\.js/],
      htmlPatterns:  [/x-data=/, /x-bind:|x-on:/],
    },
  },

  // ── Meta-frameworks

  {
    id: 'nextjs',
    name: 'Next.js',
    category: FRAMEWORK_CATEGORIES.META,
    homepage: 'https://nextjs.org',
    color: '#000000',
    description: 'The React framework for the web — SSR, SSG, and App Router.',
    psi: {
      stackPackId: 'next.js',
      scriptPatterns: [/\/_next\/static\//, /next[@/]/, /nextjs/],
      htmlPatterns:  [/__NEXT_DATA__/, /__next/, /next\/dist/],
    },
  },
  {
    id: 'nuxt',
    name: 'Nuxt',
    category: FRAMEWORK_CATEGORIES.META,
    homepage: 'https://nuxt.com',
    color: '#00DC82',
    description: 'The intuitive Vue framework — SSR, SSG, and full-stack.',
    psi: {
      stackPackId: 'nuxt',
      scriptPatterns: [/\/_nuxt\//, /nuxt[@/]/],
      htmlPatterns:  [/__NUXT__/, /data-n-head/, /nuxt-link/],
    },
  },
  {
    id: 'sveltekit',
    name: 'SvelteKit',
    category: FRAMEWORK_CATEGORIES.META,
    homepage: 'https://kit.svelte.dev',
    color: '#FF3E00',
    description: 'Full-stack Svelte apps with filesystem-based routing.',
    psi: {
      scriptPatterns: [/\/@sveltejs\/kit/, /\/_app\/immutable\//],
      htmlPatterns:  [/data-sveltekit-/, /sveltekit:/],
    },
  },
  {
    id: 'astro',
    name: 'Astro',
    category: FRAMEWORK_CATEGORIES.META,
    homepage: 'https://astro.build',
    color: '#FF5D01',
    description: 'The web framework for content-driven websites.',
    psi: {
      scriptPatterns: [/\/@astrojs\//, /astro[@/]/],
      htmlPatterns:  [/data-astro-/, /astro-island/, /astro:page-load/],
    },
  },
  {
    id: 'remix',
    name: 'Remix',
    category: FRAMEWORK_CATEGORIES.META,
    homepage: 'https://remix.run',
    color: '#E8F2FF',
    description: 'Full-stack React framework focused on web standards.',
    psi: {
      scriptPatterns: [/\/@remix-run\//, /remix[@/]/],
      htmlPatterns:  [/__remixContext/, /data-remix-/],
    },
  },
  {
    id: 'gatsby',
    name: 'Gatsby',
    category: FRAMEWORK_CATEGORIES.META,
    homepage: 'https://gatsbyjs.com',
    color: '#663399',
    description: 'React-based static site generator with GraphQL data layer.',
    psi: {
      stackPackId: 'gatsby',
      scriptPatterns: [/\/gatsby-/, /gatsby[@/]/],
      htmlPatterns:  [/___gatsby/, /gatsby-image/, /data-gatsby-/],
    },
  },
  {
    id: 'vite',
    name: 'Vite',
    category: FRAMEWORK_CATEGORIES.META,
    homepage: 'https://vitejs.dev',
    color: '#646CFF',
    description: 'Next generation frontend tooling — blazing fast HMR & build.',
    psi: {
      scriptPatterns: [/\/@vite\/client/, /vite[@/]/],
      htmlPatterns:  [/type="module"[^>]*src="[^"]*\.js"/],
    },
  },

  // Headless CMS

  {
    id: 'wordpress',
    name: 'WordPress',
    category: FRAMEWORK_CATEGORIES.CMS,
    homepage: 'https://wordpress.org',
    color: '#21759B',
    description: 'The world\'s most popular open-source CMS.',
    psi: {
      stackPackId: 'wordpress',
      scriptPatterns: [/\/wp-content\//, /\/wp-includes\//],
      htmlPatterns:  [/wp-content/, /wp-json/, /xmlrpc\.php/],
    },
    dns: {
      rules: [
        { type: 'ns', pattern: /wpengine\.com$/i,    weight: 30 },
        { type: 'ns', pattern: /kinsta\.com$/i,      weight: 25 },
        { type: 'ns', pattern: /pantheon\.io$/i,     weight: 20 },
      ],
    },
  },
  {
    id: 'contentful',
    name: 'Contentful',
    category: FRAMEWORK_CATEGORIES.CMS,
    homepage: 'https://contentful.com',
    color: '#FAE050',
    description: 'API-first headless CMS for digital teams.',
    psi: {
      scriptPatterns: [/contentful[@/]/, /cdn\.contentful\.com/],
      htmlPatterns:  [/contentful/],
    },
  },

  // Hosting & Deployment

  {
    id: 'vercel',
    name: 'Vercel',
    category: FRAMEWORK_CATEGORIES.HOSTING,
    homepage: 'https://vercel.com',
    color: '#000000',
    description: 'Deploy Next.js, React, Vue, Svelte and more at the edge.',
    nativeDomainPattern: /\.vercel\.app$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /cname\.vercel-dns\.com$/i, weight: 50 },
        { type: 'cname', pattern: /\.vercel\.app$/i,          weight: 40 },
        { type: 'a',     pattern: /^76\.76\.21\./,            weight: 30 },
      ],
    },
    psi: {
      htmlPatterns: [/x-vercel-id/, /vercel\.app/],
    },
  },
  {
    id: 'netlify',
    name: 'Netlify',
    category: FRAMEWORK_CATEGORIES.HOSTING,
    homepage: 'https://netlify.com',
    color: '#00C7B7',
    description: 'JAMstack hosting with CI/CD, functions, and edge.',
    nativeDomainPattern: /\.netlify\.app$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.netlify\.app$/i,   weight: 50 },
        { type: 'cname', pattern: /netlify\.com$/i,     weight: 30 },
        { type: 'ns',    pattern: /nsone\.net$/i,       weight: 20 },
      ],
    },
    psi: {
      htmlPatterns: [/netlify/],
    },
  },
  {
    id: 'github-pages',
    name: 'GitHub Pages',
    category: FRAMEWORK_CATEGORIES.HOSTING,
    homepage: 'https://pages.github.com',
    color: '#181717',
    description: 'Free static site hosting directly from GitHub repos.',
    nativeDomainPattern: /\.github\.io$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.github\.io$/i,                    weight: 50 },
        { type: 'a',     pattern: /^185\.199\.(10[89]|11[01])\.\d+$/, weight: 40 },
      ],
    },
  },
  {
    id: 'cloudflare-pages',
    name: 'Cloudflare Pages',
    category: FRAMEWORK_CATEGORIES.HOSTING,
    homepage: 'https://pages.cloudflare.com',
    color: '#F38020',
    description: 'JAMstack platform with Cloudflare\'s global edge network.',
    nativeDomainPattern: /\.pages\.dev$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.pages\.dev$/i,        weight: 50 },
        { type: 'ns',    pattern: /cloudflare\.com$/i,     weight: 25 },
      ],
    },
  },
  {
    id: 'render',
    name: 'Render',
    category: FRAMEWORK_CATEGORIES.HOSTING,
    homepage: 'https://render.com',
    color: '#46E3B7',
    description: 'Cloud platform for web services, static sites, and databases.',
    nativeDomainPattern: /\.onrender\.com$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.onrender\.com$/i, weight: 50 },
      ],
    },
  },
  {
    id: 'railway',
    name: 'Railway',
    category: FRAMEWORK_CATEGORIES.HOSTING,
    homepage: 'https://railway.app',
    color: '#0B0D0E',
    description: 'Infrastructure for deploying apps and databases instantly.',
    nativeDomainPattern: /\.railway\.app$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.railway\.app$/i,     weight: 50 },
        { type: 'cname', pattern: /proxy\.rlwy\.net$/i,   weight: 40 },
      ],
    },
  },
  {
    id: 'heroku',
    name: 'Heroku',
    category: FRAMEWORK_CATEGORIES.HOSTING,
    homepage: 'https://heroku.com',
    color: '#430098',
    description: 'Cloud application platform supporting many languages.',
    nativeDomainPattern: /\.herokuapp\.com$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.herokuapp\.com$/i,  weight: 50 },
        { type: 'cname', pattern: /herokudns\.com$/i,    weight: 40 },
        { type: 'ns',    pattern: /herokudns\.com$/i,    weight: 30 },
      ],
    },
  },
  {
    id: 'firebase',
    name: 'Firebase Hosting',
    category: FRAMEWORK_CATEGORIES.BACKEND,
    homepage: 'https://firebase.google.com/products/hosting',
    color: '#FFCA28',
    description: 'Google\'s fast and secure web hosting with a CDN.',
    nativeDomainPattern: /\.web\.app$|\.firebaseapp\.com$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.web\.app$/i,          weight: 50 },
        { type: 'cname', pattern: /\.firebaseapp\.com$/i,  weight: 50 },
      ],
    },
    psi: {
      scriptPatterns: [/firebase[@/]/, /firebaseapp\.com/],
    },
  },

  // CDN & Edge

  {
    id: 'cloudflare',
    name: 'Cloudflare',
    category: FRAMEWORK_CATEGORIES.CDN,
    homepage: 'https://cloudflare.com',
    color: '#F38020',
    description: 'CDN, DDoS protection, DNS, and edge computing platform.',
    dns: {
      rules: [
        { type: 'ns', pattern: /cloudflare\.com$/i,        weight: 50 },
        { type: 'a',  pattern: /^104\.(1[6-9]|2[0-7])\./, weight: 20 },
      ],
    },
  },
  {
    id: 'fastly',
    name: 'Fastly',
    category: FRAMEWORK_CATEGORIES.CDN,
    homepage: 'https://fastly.com',
    color: '#FF282D',
    description: 'Edge cloud platform for CDN, streaming, and security.',
    dns: {
      rules: [
        { type: 'cname', pattern: /\.fastly\.net$/i, weight: 50 },
        { type: 'a',     pattern: /^151\.101\./,     weight: 30 },
      ],
    },
  },
  {
    id: 'aws-cloudfront',
    name: 'AWS CloudFront',
    category: FRAMEWORK_CATEGORIES.CDN,
    homepage: 'https://aws.amazon.com/cloudfront/',
    color: '#FF9900',
    description: 'Amazon\'s global content delivery network.',
    nativeDomainPattern: /\.cloudfront\.net$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.cloudfront\.net$/i, weight: 50 },
      ],
    },
  },

  // Ecommerce

  {
    id: 'shopify',
    name: 'Shopify',
    category: FRAMEWORK_CATEGORIES.ECOMMERCE,
    homepage: 'https://shopify.com',
    color: '#95BF47',
    description: 'Leading ecommerce platform for online stores.',
    nativeDomainPattern: /\.myshopify\.com$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.myshopify\.com$/i, weight: 50 },
        { type: 'a',     pattern: /^23\.227\.38\./,     weight: 30 },
      ],
    },
    psi: {
      stackPackId: 'shopify',
      scriptPatterns: [/cdn\.shopify\.com/, /shopify[@/]/],
      htmlPatterns:  [/Shopify\.theme/, /myshopify\.com/],
    },
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    category: FRAMEWORK_CATEGORIES.ECOMMERCE,
    homepage: 'https://woo.com',
    color: '#7F54B3',
    description: 'Open-source ecommerce built on WordPress.',
    psi: {
      stackPackId: 'woocommerce',
      scriptPatterns: [/\/woocommerce\//, /wc-cart/, /wc_add_to_cart/],
      htmlPatterns:  [/woocommerce/, /wc-block/],
    },
  },
  {
    id: 'bigcommerce',
    name: 'BigCommerce',
    category: FRAMEWORK_CATEGORIES.ECOMMERCE,
    homepage: 'https://bigcommerce.com',
    color: '#34313F',
    description: 'Enterprise ecommerce platform for high-growth brands.',
    nativeDomainPattern: /\.mybigcommerce\.com$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.bigcommerce\.com$/i,   weight: 50 },
        { type: 'cname', pattern: /\.mybigcommerce\.com$/i, weight: 50 },
      ],
    },
    psi: {
      scriptPatterns: [/bigcommerce[@/]/, /cdn\.bigcommerce\.com/],
    },
  },

  // Website Builders

  {
    id: 'webflow',
    name: 'Webflow',
    category: FRAMEWORK_CATEGORIES.BUILDER,
    homepage: 'https://webflow.com',
    color: '#146EF5',
    description: 'Visual web design tool generating production-ready code.',
    nativeDomainPattern: /\.webflow\.io$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.webflow\.io$/i,        weight: 50 },
        { type: 'cname', pattern: /proxy\.webflow\.com$/i,  weight: 50 },
      ],
    },
    psi: {
      scriptPatterns: [/webflow[@/]/, /cdn\.prod\.website-files\.com/],
      htmlPatterns:  [/data-wf-/, /webflow\.com/],
    },
  },
  {
    id: 'framer',
    name: 'Framer',
    category: FRAMEWORK_CATEGORIES.BUILDER,
    homepage: 'https://framer.com',
    color: '#0099FF',
    description: 'Design and publish production websites with AI and motion.',
    nativeDomainPattern: /\.framer\.app$|\.framer\.website$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.framer\.app$/i,           weight: 50 },
        { type: 'cname', pattern: /framerusercontent\.com$/i,  weight: 40 },
      ],
    },
    psi: {
      scriptPatterns: [/framerusercontent\.com/, /framer[@/]/],
      htmlPatterns:  [/framer-motion/, /__framer/],
    },
  },
  {
    id: 'squarespace',
    name: 'Squarespace',
    category: FRAMEWORK_CATEGORIES.BUILDER,
    homepage: 'https://squarespace.com',
    color: '#121212',
    description: 'All-in-one website builder with beautiful templates.',
    nativeDomainPattern: /\.squarespace\.com$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /ext-cust\.squarespace\.com$/i, weight: 50 },
        { type: 'a',     pattern: /^198\.185\.159\./,             weight: 30 },
      ],
    },
    psi: {
      stackPackId: 'squarespace',
      scriptPatterns: [/squarespace[@/]/, /static1\.squarespace\.com/],
      htmlPatterns:  [/squarespace\.com/, /Static\.SQUARESPACE_CONTEXT/],
    },
  },
  {
    id: 'wix',
    name: 'Wix',
    category: FRAMEWORK_CATEGORIES.BUILDER,
    homepage: 'https://wix.com',
    color: '#0C6EFC',
    description: 'Drag-and-drop website builder with app marketplace.',
    nativeDomainPattern: /\.wixsite\.com$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.wixdns\.net$/i, weight: 50 },
        { type: 'ns',    pattern: /wixdns\.net$/i,   weight: 30 },
      ],
    },
    psi: {
      stackPackId: 'wix',
      scriptPatterns: [/static\.parastorage\.com/, /wix[@/]/],
      htmlPatterns:  [/wixstatic\.com/, /_wixCIDX/],
    },
  },
  {
    id: 'ghost',
    name: 'Ghost',
    category: FRAMEWORK_CATEGORIES.BUILDER,
    homepage: 'https://ghost.org',
    color: '#15171A',
    description: 'Open-source publishing platform for blogs and newsletters.',
    nativeDomainPattern: /\.ghost\.io$/i,
    dns: {
      rules: [
        { type: 'cname', pattern: /\.ghost\.io$/i, weight: 50 },
      ],
    },
    psi: {
      stackPackId: 'ghost',
      scriptPatterns: [/ghost[@/]/, /\/ghost\//],
      htmlPatterns:  [/ghost-theme/, /data-ghost/],
    },
  },

  // Analytics

  {
    id: 'gtm',
    name: 'Google Tag Manager',
    category: FRAMEWORK_CATEGORIES.ANALYTICS,
    homepage: 'https://tagmanager.google.com',
    color: '#4285F4',
    description: 'Tag management system for managing analytics and marketing tags.',
    psi: {
      scriptPatterns: [/googletagmanager\.com\/gtm\.js/, /gtm\.js\?id=GTM-/],
      htmlPatterns:  [/GTM-[A-Z0-9]+/],
    },
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    category: FRAMEWORK_CATEGORIES.ANALYTICS,
    homepage: 'https://analytics.google.com',
    color: '#E37400',
    description: 'Google\'s next-generation web and app analytics platform.',
    psi: {
      scriptPatterns: [/googletagmanager\.com\/gtag\/js/, /gtag\/js\?id=G-/],
      htmlPatterns:  [/gtag\('config',\s*'G-/],
    },
  },
]

// Score helpers

export function maxDnsScore(sig) {
  return (sig.dns?.rules ?? []).reduce((s, r) => s + r.weight, 0)
}

// PSI sub-scores: stackPack match=40, each scriptPattern hit=15, each htmlPattern hit=10
export function scorePsi(sig, { stackPackIds, scriptUrls, html }) {
  if (!sig.psi) return { score: 0, max: 0, signals: [] }

  let score = 0
  const signals = []
  const sp  = sig.psi

  if (sp.stackPackId && stackPackIds.has(sp.stackPackId)) {
    score += 40
    signals.push({ type: 'stackpack', label: `Lighthouse stack pack: ${sp.stackPackId}` })
  }

  for (const pat of sp.scriptPatterns ?? []) {
    if (scriptUrls.some(u => pat.test(u))) {
      score += 15
      signals.push({ type: 'script', label: `Script URL matched: ${pat.source}` })
      break // count once per pattern group
    }
  }

  for (const pat of sp.htmlPatterns ?? []) {
    if (pat.test(html)) {
      score += 10
      signals.push({ type: 'html', label: `HTML pattern matched: ${pat.source}` })
      break
    }
  }

  const max = (sp.stackPackId ? 40 : 0) +
    ((sp.scriptPatterns?.length ?? 0) > 0 ? 15 : 0) +
    ((sp.htmlPatterns?.length  ?? 0) > 0 ? 10 : 0)

  return { score, max, signals }
}