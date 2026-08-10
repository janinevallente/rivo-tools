import { useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { Copy, Check, Trash2, ShieldCheck } from 'lucide-react'
import CryptoJS from 'crypto-js'
import PageHeader from '../components/ui/PageHeader'

const ALGORITHMS = [
  { id: 'MD5', label: 'MD5', hash: (text) => CryptoJS.MD5(text) },
  { id: 'SHA1', label: 'SHA-1', hash: (text) => CryptoJS.SHA1(text) },
  { id: 'SHA256', label: 'SHA-256', hash: (text) => CryptoJS.SHA256(text) },
  { id: 'SHA512', label: 'SHA-512', hash: (text) => CryptoJS.SHA512(text) },
  { id: 'SHA3', label: 'SHA-3', hash: (text) => CryptoJS.SHA3(text) },
  { id: 'RIPEMD160', label: 'RIPEMD-160', hash: (text) => CryptoJS.RIPEMD160(text) },
]

export default function HashGenerator() {
  const [input, setInput] = useState('')
  const [uppercase, setUppercase] = useState(false)
  const [copiedTarget, setCopiedTarget] = useState(null)

  const hashes = useMemo(() => {
    if (!input) return {}
    const result = {}
    for (const algo of ALGORITHMS) {
      try {
        const digest = algo.hash(input).toString(CryptoJS.enc.Hex)
        result[algo.id] = uppercase ? digest.toUpperCase() : digest
      } catch {
        result[algo.id] = ''
      }
    }
    return result
  }, [input, uppercase])

  const copyToClipboard = (text, id) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedTarget(id)
    setTimeout(() => {
      setCopiedTarget(current => (current === id ? null : current))
    }, 1500)
  }

  const clearInput = () => {
    setInput('')
    setCopiedTarget(null)
  }

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Hash Generator</title>
      </Helmet>
      <PageHeader
        title="Hash Generator"
        description="Generate MD5, SHA-1, SHA-256, SHA-512, SHA-3, and RIPEMD-160 hashes from text."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-textHeader m-0">Input Text</h2>
            {input && (
              <button
                onClick={clearInput}
                title="Clear input"
                 className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-errorBg text-error border border-errorBorder cursor-pointer hover:opacity-80 transition-opacity"
              >
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or paste text here to generate its hash..."
            rows={10}
            className="w-full px-4 py-3 rounded-xl bg-backgroundColor border border-borderColor text-textHeader text-sm font-mono resize-none outline-none focus:border-accentBorder transition-colors placeholder:text-text"
          />

          <label className="flex items-center gap-2.5 mt-4 px-3 py-2.5 rounded-xl border border-borderColor bg-backgroundColor cursor-pointer hover:border-accentBorder transition-colors w-fit">
            <input
              type="checkbox"
              checked={uppercase}
              onChange={() => setUppercase(v => !v)}
              className="w-4 h-4 accent-accent cursor-pointer"
            />
            <span className="text-sm text-textHeader">Uppercase output</span>
          </label>
        </div>

        {/* Right: Safety note and results */}
        <div className="flex flex-col gap-6">
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck size={20} className="text-accent shrink-0" />
              <h3 className="text-sm font-semibold text-textHeader m-0">Privacy Note</h3>
            </div>
            <p className="text-text text-sm leading-relaxed m-0">
              Hashing happens entirely in your browser — nothing you type is sent to a server. MD5 and SHA-1 are fine for checksums, deduplication, and other non-adversarial integrity checks, but both are cryptographically broken and unsafe for security-sensitive purposes like password storage or digital signatures; use SHA-256, SHA-512, or SHA-3 instead. (
              <a
                href="https://csrc.nist.gov/news/2017/research-results-on-sha-1-collisions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:opacity-80"
              >
                source: NIST
              </a>
              )
            </p>
          </div>

          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-textHeader m-0 mb-3">Hashes</h3>
            {input ? (
              <div className="flex flex-col gap-2">
                {ALGORITHMS.map((algo) => (
                  <div
                    key={algo.id}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-backgroundColor border border-borderColor"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-accent mb-0.5">{algo.label}</div>
                      <div className="text-xs font-mono text-textHeader break-all">{hashes[algo.id]}</div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(hashes[algo.id], algo.id)}
                      title={`Copy ${algo.label} hash`}
                      className="shrink-0 p-1.5 rounded-md bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {copiedTarget === algo.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text text-xs m-0">Enter some text on the left to see its hashes here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}