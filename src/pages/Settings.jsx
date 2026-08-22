import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Modal, Switch } from 'antd'
import { Sun, Moon, Trash2, CheckCircle2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useTheme } from '../components/themes/ThemeContext'
import { clearAllToolCaches } from '../utils/toolResultCache'

function SettingRow({ title, description, children }) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-textHeader m-0">{title}</p>
        <p className="text-xs text-text m-0 mt-0.5 max-w-lg">{description}</p>
      </div>
      <div className="shrink-0 w-full sm:w-auto">{children}</div>
    </div>
  )
}

function SettingsSection({ title, children }) {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-semibold tracking-[0.08em] text-text uppercase px-1 pb-2 m-0">
        {title}
      </p>
      <div className="bg-backgroundCard border border-borderColor rounded-2xl divide-y divide-borderColor overflow-hidden">
        {children}
      </div>
    </div>
  )
}

export default function Settings() {
  const { themeMode, toggleTheme } = useTheme()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [justCleared, setJustCleared] = useState(false)

  const handleConfirmClear = () => {
    setClearing(true)
    // Only ever touches keys under the tool-cache prefix — rivo-theme lives
    // under a separate key entirely and is never read or removed here.
    clearAllToolCaches()
    setClearing(false)
    setConfirmOpen(false)
    setJustCleared(true)
    setTimeout(() => setJustCleared(false), 3000)
  }

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Settings</title>
      </Helmet>
      <PageHeader
        title="Settings"
        description="Manage appearance and locally stored data for Rivo."
      />

      <SettingsSection title="Appearance">
        <SettingRow
          title="Theme"
          description={`Rivo is currently using ${themeMode === 'dark' ? 'dark' : 'light'} mode on this device.`}
        >
          <div className="flex items-center gap-2.5">
            <Sun size={15} className={themeMode === 'light' ? 'text-accent' : 'text-text'} />
            <Switch
              checked={themeMode === 'dark'}
              onChange={toggleTheme}
              size="small"
              aria-label="Toggle color theme"
            />
            <Moon size={15} className={themeMode === 'dark' ? 'text-accent' : 'text-text'} />
          </div>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Data & Storage">
        <SettingRow
          title="Clear Tool Cache"
          description="Tools that saved your last query result in this browser so switching between them doesn't force a re-query. This clears all of that. Your theme preference is not affected."
        >
          {justCleared ? (
            <span className="inline-flex items-center justify-center sm:justify-start gap-1.5 text-xs font-medium text-green-400 w-full sm:w-auto">
              <CheckCircle2 size={14} />
              Cleared
            </span>
          ) : (
            <button
              onClick={() => setConfirmOpen(true)}
              className="flex items-center justify-center sm:justify-start gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-400/30 cursor-pointer hover:bg-red-500/20 transition-colors w-full sm:w-auto"
            >
              <Trash2 size={13} />
              Clear Tool Cache
            </button>
          )}
        </SettingRow>
      </SettingsSection>

      <Modal
        title="Are you sure to clear tool cache?"
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={handleConfirmClear}
        okText="Clear Cache"
        cancelText="Cancel"
        okButtonProps={{ danger: true, loading: clearing }}
        centered
        width={440}
      >
        <p className="text-sm text-text m-0">
          This removes every tool's saved result from this browser, so the next time you open them you'll need to run the query again.
          This does not affect your light/dark theme preference.
        </p>
      </Modal>
    </div>
  )
}