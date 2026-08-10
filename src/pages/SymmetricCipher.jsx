import { useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import CryptoJS from 'crypto-js'
import { Select } from 'antd'
import { Lock, Unlock, Copy, Check, Trash2, ShieldCheck, Eye, EyeOff, ArrowRightLeft } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

// Block ciphers support a chosen mode + padding scheme; stream ciphers
// (RC4, Rabbit) encrypt byte-by-byte and have no concept of either.
const BLOCK_CIPHERS = ['AES', 'DES', 'TripleDES']

const ALGORITHMS = [
  { id: 'AES', label: 'AES', cipher: CryptoJS.AES },
  { id: 'DES', label: 'DES', cipher: CryptoJS.DES },
  { id: 'TripleDES', label: 'Triple DES (3DES)', cipher: CryptoJS.TripleDES },
  { id: 'RC4', label: 'RC4', cipher: CryptoJS.RC4 },
  { id: 'Rabbit', label: 'Rabbit', cipher: CryptoJS.Rabbit },
]

const MODES = [
  { id: 'CBC', label: 'CBC', mode: CryptoJS.mode.CBC },
  { id: 'ECB', label: 'ECB', mode: CryptoJS.mode.ECB },
  { id: 'CFB', label: 'CFB', mode: CryptoJS.mode.CFB },
  { id: 'OFB', label: 'OFB', mode: CryptoJS.mode.OFB },
  { id: 'CTR', label: 'CTR', mode: CryptoJS.mode.CTR },
]

const PADDINGS = [
  { id: 'Pkcs7', label: 'PKCS7', padding: CryptoJS.pad.Pkcs7 },
  { id: 'ZeroPadding', label: 'Zero Padding', padding: CryptoJS.pad.ZeroPadding },
  { id: 'NoPadding', label: 'No Padding', padding: CryptoJS.pad.NoPadding },
  { id: 'AnsiX923', label: 'ANSI X.923', padding: CryptoJS.pad.AnsiX923 },
  { id: 'Iso10126', label: 'ISO 10126', padding: CryptoJS.pad.Iso10126 },
  { id: 'Iso97971', label: 'ISO/IEC 9797-1', padding: CryptoJS.pad.Iso97971 },
]

function runCipher({ action, algorithmId, modeId, paddingId, key, text }) {
  const algorithm = ALGORITHMS.find(a => a.id === algorithmId)
  const isBlockCipher = BLOCK_CIPHERS.includes(algorithmId)
  const config = isBlockCipher
    ? {
        mode: MODES.find(m => m.id === modeId)?.mode,
        padding: PADDINGS.find(p => p.id === paddingId)?.padding,
      }
    : {}

  if (action === 'encrypt') {
    return algorithm.cipher.encrypt(text, key, config).toString()
  }

  const bytes = algorithm.cipher.decrypt(text, key, config)
  const plaintext = bytes.toString(CryptoJS.enc.Utf8)
  if (!plaintext) throw new Error('Empty result')
  return plaintext
}

export default function EncryptDecrypt() {
  const [action, setAction] = useState('encrypt')
  const [algorithmId, setAlgorithmId] = useState('AES')
  const [modeId, setModeId] = useState('CBC')
  const [paddingId, setPaddingId] = useState('Pkcs7')
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const isBlockCipher = BLOCK_CIPHERS.includes(algorithmId)

  const { output, error } = useMemo(() => {
    if (!input || !key) return { output: '', error: null }
    try {
      return { output: runCipher({ action, algorithmId, modeId, paddingId, key, text: input }), error: null }
    } catch {
      return {
        output: '',
        error: action === 'encrypt'
          ? 'Encryption failed. Check your input and settings.'
          : 'Decryption failed — the secret key, algorithm, mode, or padding likely don\u2019t match what was used to encrypt this text.',
      }
    }
  }, [action, algorithmId, modeId, paddingId, key, input])

  const swapMode = () => {
    setAction(a => (a === 'encrypt' ? 'decrypt' : 'encrypt'))
    setInput(output || '')
  }

  const copyToClipboard = () => {
    if (!output) return
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const clearAll = () => {
    setInput('')
  }

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Symmetric Cipher</title>
      </Helmet>
      <PageHeader
        title="Symmetric Cipher"
        description="Symmetric encryption and decryption — AES, DES, Triple DES, RC4, and Rabbit."
        badge="Beta"
      />

      {/* Encrypt / Decrypt toggle */}
      <div className="flex items-center gap-2 mb-6">
        <div className="inline-flex p-1 rounded-xl bg-backgroundCard border border-borderColor">
          <button
            onClick={() => setAction('encrypt')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors border-none ${
              action === 'encrypt' ? 'bg-accent text-white' : 'bg-transparent text-text hover:text-textHeader'
            }`}
          >
            <Lock size={14} /> Encrypt
          </button>
          <button
            onClick={() => setAction('decrypt')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors border-none ${
              action === 'decrypt' ? 'bg-accent text-white' : 'bg-transparent text-text hover:text-textHeader'
            }`}
          >
            <Unlock size={14} /> Decrypt
          </button>
        </div>
        {output && (
          <button
            onClick={swapMode}
            title={`Use this output as the ${action === 'encrypt' ? 'decrypt' : 'encrypt'} input`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
          >
            <ArrowRightLeft size={12} />
            Send to {action === 'encrypt' ? 'Decrypt' : 'Encrypt'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input + settings */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-textHeader m-0">
              {action === 'encrypt' ? 'Plaintext' : 'Ciphertext'}
            </h2>
            {input && (
              <button
                onClick={clearAll}
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
            placeholder={action === 'encrypt' ? 'Type or paste text to encrypt...' : 'Paste ciphertext to decrypt...'}
            rows={6}
            className="w-full px-4 py-3 rounded-xl bg-backgroundColor border border-borderColor text-textHeader text-sm font-mono resize-none outline-none focus:border-accentBorder transition-colors placeholder:text-text"
          />

          {/* Secret key */}
          <div className="mt-4">
            <label className="text-xs font-semibold text-text uppercase tracking-wide mb-1.5 block">Secret Key / Passphrase</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter a secret key..."
                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-backgroundColor border border-borderColor text-textHeader text-sm font-mono outline-none focus:border-accentBorder transition-colors placeholder:text-text"
              />
              <button
                onClick={() => setShowKey(v => !v)}
                title={showKey ? 'Hide key' : 'Show key'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text hover:text-accent transition-colors bg-transparent border-none cursor-pointer p-0.5"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Algorithm */}
          <div className="mt-4">
            <label className="text-xs font-semibold text-text uppercase tracking-wide mb-1.5 block">Algorithm</label>
            <Select
              value={algorithmId}
              onChange={setAlgorithmId}
              className="w-full"
              popupMatchSelectWidth={false}
              options={ALGORITHMS.map(a => ({ value: a.id, label: a.label }))}
            />
          </div>

          {/* Mode + Padding (block ciphers only) */}
          {isBlockCipher && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="text-xs font-semibold text-text uppercase tracking-wide mb-1.5 block">Mode</label>
                <Select
                  value={modeId}
                  onChange={setModeId}
                  className="w-full"
                  popupMatchSelectWidth={false}
                  options={MODES.map(m => ({ value: m.id, label: m.label }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text uppercase tracking-wide mb-1.5 block">Padding</label>
                <Select
                  value={paddingId}
                  onChange={setPaddingId}
                  className="w-full"
                  popupMatchSelectWidth={false}
                  options={PADDINGS.map(p => ({ value: p.id, label: p.label }))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Safety note + output */}
        <div className="flex flex-col gap-6">
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck size={20} className="text-accent shrink-0" />
              <h3 className="text-sm font-semibold text-textHeader m-0">Privacy Note</h3>
            </div>
            <p className="text-text text-sm leading-relaxed m-0">
              Encryption and decryption happen entirely in your browser — no data is sent to a server. Keys are securely derived from your passphrase, producing different ciphertext even with the same input. DES and RC4 are outdated and not recommended for sensitive data; use AES whenever possible. Modes like CBC, ECB, CFB, OFB, and CTR provide encryption only and do not protect against tampering like AES-GCM.
            </p>
          </div>

          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-textHeader m-0">
                {action === 'encrypt' ? 'Ciphertext' : 'Plaintext'}
              </h3>
              {output && (
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  Copy
                </button>
              )}
            </div>

            {error ? (
              <p className="text-xs text-red-400 m-0">{error}</p>
            ) : output ? (
              <div className="px-4 py-3 rounded-xl bg-backgroundColor border border-borderColor">
                <p className="text-xs font-mono text-textHeader break-all m-0">{output}</p>
              </div>
            ) : (
              <p className="text-text text-xs m-0">
                Enter {action === 'encrypt' ? 'text' : 'ciphertext'} and a secret key to see the result here.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}