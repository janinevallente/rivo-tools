import { useState } from 'react'
import { Modal } from 'antd'
import { 
  ShieldCheck,
  Globe,
  HardDrive,
  EyeOff 
} from 'lucide-react'
import { tools } from "../data/toolsData"

export default function Home({ onSelectTool }) {
  const [privacyOpen, setPrivacyOpen] = useState(false)

  return (
    <div className="mx-auto px-5 md:px-10 pt-8 pb-10 font-poppins">
      <div className="text-left mb-10">
        <h1 className="text-4xl font-bold mb-4 text-textHeader tracking-tight leading-tight">
          Rivo
        </h1>
        <p className="text-text text-[15px] leading-relaxed">
            A growing collection of fast, privacy-first tech utilities that run entirely in your browser.
            No installs. No server uploads. Just tools that work instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mx-auto">
        {tools.map(({ id, icon: Icon, label, description, tags }) => (
          <button
            key={id}
            onClick={() => onSelectTool(id)}
            className="bg-backgroundCard border border-borderColor rounded-2xl p-4 text-left cursor-pointer transition-all duration-150 hover:border-accentBorder hover:-translate-y-0.5"
          >
            <div className="flex flex-row items-center gap-3 mb-2 w-full">
              <div className="text-accent bg-accentBg border border-accentBorder rounded-xl flex items-center justify-center p-2 shrink-0">
                <Icon size={18} />
              </div>
              <h2 className="text-sm font-semibold text-textHeader m-0 flex-1 min-w-0">{label}</h2>
            </div>
            <p className="text-[12px] text-text mb-1 leading-relaxed">{description}</p>
          </button>
        ))}
      </div>

      {/* About */}
      <div className="mx-auto mt-20 px-1 pt-10 border-t border-borderColor">
        <h2 className="text-xl font-bold text-textHeader mb-4">About</h2>

        <p className="text-text text-[14px] leading-relaxed mb-4 max-w-4xl">
          Rivo started as a handful of image and color utilities and has grown into a full toolbox for
          the modern web — Tailwind helpers, network and performance diagnostics, security tools, and quick
          references, all in one place.
        </p>

        <p className="text-text text-[14px] leading-relaxed mb-8 max-w-4xl">
          Built from a love for the real web: open, experimental, and endlessly creative.
          Rivo exists to make every tech enthusiast work a little faster, clearer, and more enjoyable.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8 max-w-4xl">
          <div>
            <h3 className="text-sm font-semibold text-textHeader mb-2">Made by</h3>
            <a
              href="https://janinevallente.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent text-sm hover:opacity-80 transition-opacity"
            >
              Janine Vallente
            </a>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-textHeader mb-2">Source</h3>
            <a
              href="https://github.com/janinevallente/rivo-tools"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent text-sm hover:opacity-80 transition-opacity"
            >
              janinevallente/rivo-tools
            </a>
          </div>
        </div>

        <div className="border-t border-borderColor mt-8 pt-6 flex flex-wrap items-center gap-2">
          <p className="text-text text-xs leading-relaxed m-0">
            © 2026 Rivo. All rights reserved.
          </p>
          <span className="text-text text-xs">|</span>
          <button
            onClick={() => setPrivacyOpen(true)}
            className="text-accent text-xs bg-transparent border-none p-0 cursor-pointer hover:opacity-80 transition-opacity text-left w-fit"
          >
            Data Privacy Policy
          </button>
        </div>
      </div>

      {/* Data Privacy Policy Modal */}
      <Modal
        title={
          <div>
            <h3 className="text-lg text-base font-semibold text-textHeader m-0">Data Privacy Policy</h3>
            <p className="text-xs text-accent font-normal m-0 mt-2.5">Last updated: August 22, 2026</p>
          </div>
        }
        open={privacyOpen}
        onCancel={() => setPrivacyOpen(false)}
        footer={
          <div className="flex justify-center pt-3">
            <button
              onClick={() => setPrivacyOpen(false)}
              className="px-6 py-2 rounded-lg text-xs font-semibold bg-accent text-white border-none cursor-pointer hover:opacity-90 transition-opacity"
            >
              I understand
            </button>
          </div>
        }
        centered
        width={560}
      >
        <div className="flex flex-col gap-4 text-sm text-text leading-relaxed max-h-[60vh] overflow-y-auto pr-1 scrollbar-hide">
          <p className="m-0 pt-5">
            Rivo is designed to be privacy-first and local-first. This policy explains what does — and
            doesn't — happen with your data when you use it.
          </p>

          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck size={16} className="text-accent shrink-0" />
              <h3 className="text-sm font-semibold text-textHeader m-0">No server-side processing</h3>
            </div>
            <p className="m-0">
              Most tools (image editing, color conversion, password/hash generation, encryption, and more)
              run entirely inside your browser. Files and inputs you feed them are processed entirely 
              on your device and are never uploaded to Rivo's servers or any external storage — nothing 
              is ever stored, logged, or retained.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Globe size={16} className="text-accent shrink-0" />
              <h3 className="text-sm font-semibold text-textHeader m-0">Direct-to-API lookups</h3>
            </div>
            <p className="m-0">
              A few tools — DNS Lookup, WHOIS Lookup, IP Address Lookup, PageSpeed Insights, and Framework
              Detector — need to reach an external service (e.g. Cloudflare's DNS resolver, RDAP
              registries, or Google's PageSpeed API) to fetch real data. These requests go straight from
              your browser to that service; they are never routed through or logged by Rivo's own servers.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <HardDrive size={16} className="text-accent shrink-0" />
              <h3 className="text-sm font-semibold text-textHeader m-0">What's stored on your device</h3>
            </div>
            <p className="m-0">
              Rivo uses your browser's local storage for two things only: your light/dark theme preference,
              and — for a couple of tools (like WHOIS and DNS Lookup) — your last query's result, so
              switching between tools doesn't force you to re-run the same search. None of this is ever
              sent anywhere; it stays on your device, and you can clear the cached tool results at any
              time from Settings.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <EyeOff size={16} className="text-accent shrink-0" />
              <h3 className="text-sm font-semibold text-textHeader m-0">No tracking, no accounts</h3>
            </div>
            <p className="m-0">
              Rivo doesn't require sign-up, doesn't use analytics or advertising trackers, and doesn't
              build a profile of you or your usage.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}