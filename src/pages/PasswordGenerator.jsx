import { useState, useEffect, useCallback, useMemo } from 'react'
import { Copy, Check, RefreshCw, ShieldCheck, Info, Trash2 } from 'lucide-react'
import { Checkbox } from 'antd'
import { generatePassword, calculateEntropy, strengthFromEntropy } from '../utils/passwordUtils'
import PageHeader from '../components/ui/PageHeader'

// Special id for the main password display's copy button, kept distinct from
// history row indices (0, 1, 2...) so they never collide.
const MAIN_COPY_ID = 'main'

export default function PasswordGenerator() {
  const [length, setLength] = useState(16)
  const [useUpper, setUseUpper] = useState(true)
  const [useLower, setUseLower] = useState(true)
  const [useNumbers, setUseNumbers] = useState(true)
  const [useSymbols, setUseSymbols] = useState(true)
  const [excludeSimilar, setExcludeSimilar] = useState(false)
  const [password, setPassword] = useState('')
  // Tracks WHICH copy button most recently succeeded (MAIN_COPY_ID or a
  // history row index) so each button's checkmark is independent of the
  // others — copying a history entry no longer flips the main button too.
  const [copiedTarget, setCopiedTarget] = useState(null)
  const [history, setHistory] = useState([])

  const options = { length, useUpper, useLower, useNumbers, useSymbols, excludeSimilar }
  const noOptionSelected = !useUpper && !useLower && !useNumbers && !useSymbols

  // Explicit, user-triggered generation only — adjusting the length or toggling
  // character sets never changes the displayed password by itself. The
  // password (and history) only update when this is called, i.e. when the
  // "Generate Password" button is clicked.
  const regenerate = useCallback(() => {
    const pwd = generatePassword(options)
    setPassword(pwd)
    setCopiedTarget(null)
    if (pwd) {
      setHistory(prev => [pwd, ...prev].slice(0, 5))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, useUpper, useLower, useNumbers, useSymbols, excludeSimilar])

  // Generate an initial password once on first load, without adding it to history.
  useEffect(() => {
    setPassword(generatePassword(options))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const poolSize = useMemo(() => {
    let charset = ''
    if (useLower) charset += 'abcdefghijklmnopqrstuvwxyz'
    if (useUpper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    if (useNumbers) charset += '0123456789'
    if (useSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?'
    if (excludeSimilar) charset = charset.split('').filter(c => !'il1Lo0O'.includes(c)).join('')
    return new Set(charset.split('')).size
  }, [useUpper, useLower, useNumbers, useSymbols, excludeSimilar])

  const entropy = useMemo(() => calculateEntropy(length, poolSize), [length, poolSize])
  const strength = strengthFromEntropy(entropy)

  // Shared copy handler for both the main display and history rows. `id`
  // identifies which button triggered the copy, so only that button shows
  // the checkmark.
  const copyToClipboard = (text, id) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedTarget(id)
    setTimeout(() => {
      setCopiedTarget(current => (current === id ? null : current))
    }, 1500)
  }

  const clearHistory = () => {
    setHistory([])
  }

  const CheckboxOption = ({ checked, onChange, label, sample }) => (
    <div
      onClick={() => onChange({ target: { checked: !checked } })}
      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-borderColor bg-backgroundColor cursor-pointer hover:border-accentBorder transition-colors"
    >
      <Checkbox checked={checked} onChange={(e) => onChange(e)} onClick={(e) => e.stopPropagation()}>
        <span className="text-sm text-textHeader">{label}</span>
      </Checkbox>
      <span className="text-xs font-mono text-text">{sample}</span>
    </div>
  )

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <PageHeader
        title="Password Generator"
        description="Generate strong, random passwords using cryptographically secure randomness."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Generator */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-textHeader m-0 mb-4">Generated Password</h2>

          {/* Password display */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 px-4 py-2.5 rounded-xl bg-backgroundColor border border-borderColor overflow-x-auto scrollbar-hide">
              <span className="text-lg font-mono text-textHeader whitespace-pre tracking-wide">
                {password || 'Select at least one option'}
              </span>
            </div>
            <button
              onClick={() => copyToClipboard(password, MAIN_COPY_ID)}
              disabled={!password}
              title="Copy to clipboard"
              className="shrink-0 p-3.5 rounded-xl bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copiedTarget === MAIN_COPY_ID ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
            </button>
          </div>

          {/* Strength meter */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-text uppercase tracking-wide">Preview Strength</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${strength.bg} ${strength.color} ${strength.border}`}>
                {noOptionSelected ? '—' : strength.label}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-backgroundColor border border-borderColor overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${noOptionSelected ? 'bg-transparent' : strength.color.replace('text-', 'bg-')}`}
                style={{ width: `${noOptionSelected ? 0 : strength.pct}%` }}
              />
            </div>
            <p className="text-xs text-text mt-1.5 m-0">
              {noOptionSelected ? 'Choose a character set to begin.' : `~${entropy.toFixed(1)} bits of entropy based on the settings below`}
            </p>
          </div>

          {/* Length slider */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-text uppercase tracking-wide">Length</label>
              <span className="text-sm font-mono text-accent font-semibold">{length}</span>
            </div>
            <input
              type="range"
              min={6}
              max={64}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2 mb-5">
            <CheckboxOption checked={useUpper} onChange={(e) => setUseUpper(e.target.checked)} label="Uppercase Letters" sample="ABC" />
            <CheckboxOption checked={useLower} onChange={(e) => setUseLower(e.target.checked)} label="Lowercase Letters" sample="abc" />
            <CheckboxOption checked={useNumbers} onChange={(e) => setUseNumbers(e.target.checked)} label="Numbers" sample="123" />
            <CheckboxOption checked={useSymbols} onChange={(e) => setUseSymbols(e.target.checked)} label="Symbols" sample="!@#" />
            <CheckboxOption checked={excludeSimilar} onChange={(e) => setExcludeSimilar(e.target.checked)} label="Exclude Similar Characters" sample="il1Lo0O" />
          </div>

          {/* Primary action */}
          <button
            onClick={regenerate}
            disabled={noOptionSelected}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-accent text-white cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Generate Password
          </button>
        </div>

        {/* Right: Safety note and Recent Password History */}
        <div className="flex flex-col gap-6">
          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck size={20} className="text-accent shrink-0" />
              <h3 className="text-sm font-semibold text-textHeader m-0">Safety Note</h3>
            </div>
            <p className="text-text text-sm leading-relaxed m-0">
              Rivo uses <code className="px-1.5 py-0.5 rounded-md bg-accentBg border border-accentBorder text-accent text-xs font-mono">window.crypto.getRandomValues</code> for true cryptographic randomness. Unlike standard random functions, this is safe for generating sensitive passwords and keys.
            </p>
          </div>

          <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <Info size={20} className="text-accent shrink-0" />
                <h3 className="text-sm font-semibold text-textHeader m-0">Recent Passwords</h3>
              </div>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  title="Clear history"
                   className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-errorBg text-error border border-errorBorder cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>
            {history.length > 0 ? (
              <div className="flex flex-col gap-2">
                {history.map((pwd, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-backgroundColor border border-borderColor"
                  >
                    <span className="text-xs font-mono text-textHeader truncate">{pwd}</span>
                    <button
                      onClick={() => copyToClipboard(pwd, i)}
                      className="shrink-0 p-1.5 rounded-md bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {copiedTarget === i ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text text-xs m-0">Generated passwords this session will appear here. Nothing is stored or sent anywhere.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}