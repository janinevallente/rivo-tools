import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Modal, Switch, Checkbox } from 'antd'
import { Sun, Moon, Trash2, CheckCircle2, Loader2, Inbox } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useTheme } from '../components/themes/ThemeContext'
import {
  TOOL_CACHE_LABELS,
  getCachedToolDetails,
  clearToolCaches,
  formatBytes,
} from '../utils/toolResultCache'

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
  const [listLoading, setListLoading] = useState(false)
  const [cachedItems, setCachedItems] = useState([])     // [{ id: 'whoisLookup', bytes: 1420 }, ...]
  const [selectedIds, setSelectedIds] = useState([])     // ids selected for deletion
  const [clearing, setClearing] = useState(false)
  const [justCleared, setJustCleared] = useState(false)

  const openClearModal = async () => {
    setConfirmOpen(true)
    setListLoading(true)
    const items = await getCachedToolDetails()
    setCachedItems(items)
    setSelectedIds(items.map(item => item.id)) // select all by default
    setListLoading(false)
  }

  const closeClearModal = () => {
    if (clearing) return
    setConfirmOpen(false)
    setCachedItems([])
    setSelectedIds([])
  }

  const toggleOne = (id, checked) => {
    setSelectedIds(prev => (checked ? [...prev, id] : prev.filter(x => x !== id)))
  }

  const toggleAll = (checked) => {
    setSelectedIds(checked ? cachedItems.map(item => item.id) : [])
  }

  const handleDelete = async () => {
    if (selectedIds.length === 0) return
    setClearing(true)
    await clearToolCaches(selectedIds)
    setClearing(false)
    setConfirmOpen(false)
    setCachedItems([])
    setSelectedIds([])
    setJustCleared(true)
    setTimeout(() => setJustCleared(false), 3000)
  }

  // Calculate total byte size of selected items
  const selectedSize = cachedItems
    .filter(item => selectedIds.includes(item.id))
    .reduce((sum, item) => sum + item.bytes, 0)

  const totalSize = cachedItems.reduce((sum, item) => sum + item.bytes, 0)
  const allSelected = selectedIds.length === cachedItems.length && cachedItems.length > 0

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
          description="Tools that saved your last query result in this browser so switching between them doesn't force a re-query. Pick which tools to clear below. Your theme preference is not affected."
        >
          {justCleared ? (
            <span className="inline-flex items-center justify-center sm:justify-start gap-1.5 text-xs font-medium text-green-400 w-full sm:w-auto">
              <CheckCircle2 size={14} />
              Cleared
            </span>
          ) : (
            <button
              onClick={openClearModal}
              className="flex items-center justify-center sm:justify-start gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-400/30 cursor-pointer hover:bg-red-500/20 transition-colors w-full sm:w-auto"
            >
              <Trash2 size={13} />
              Clear
            </button>
          )}
        </SettingRow>
      </SettingsSection>

      <Modal
        title={
          <div className="flex items-center justify-between pr-6">
            <span className="text-base font-semibold text-textHeader">Clear Tool Cache</span>
            {!listLoading && cachedItems.length > 0 && (
              <span className="text-xs font-normal text-text bg-accentBg px-2.5 py-1 rounded-full border border-accentBorder">
                Total: {formatBytes(totalSize)}
              </span>
            )}
          </div>
        }
        open={confirmOpen}
        onCancel={closeClearModal}
        closable={!clearing}
        maskClosable={!clearing}
        keyboard={!clearing}
        cancelButtonProps={{ disabled: clearing }}
        onOk={handleDelete}
        okText={selectedIds.length > 0 ? `Delete (${formatBytes(selectedSize)})` : 'Delete'}
        cancelText="Cancel"
        okButtonProps={{
          danger: true,
          loading: clearing,
          disabled: listLoading || selectedIds.length === 0,
        }}
        centered
        width={460}
      >
        {listLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-text">
            <Loader2 size={16} className="animate-spin" />
            Calculating stored data…
          </div>
        ) : cachedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Inbox size={24} className="text-text" />
            <p className="text-sm text-text m-0">No tools have cached results right now.</p>
          </div>
        ) : (
          <div className="flex flex-col pt-2">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-borderColor">
              <span className="text-xs text-text">Select tool(s) to clear cache:</span>
              <button
                type="button"
                onClick={() => toggleAll(!allSelected)}
                className="text-xs text-accent bg-transparent border-none p-0 cursor-pointer hover:underline"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="flex flex-col max-h-64 overflow-y-auto scrollbar-hide">
              {cachedItems.map(({ id, bytes }) => (
                <label key={id} className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-accentBg/30 px-1 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Checkbox
                      checked={selectedIds.includes(id)}
                      onChange={e => toggleOne(id, e.target.checked)}
                    />
                    <span className="text-sm text-textHeader font-medium truncate">
                      {TOOL_CACHE_LABELS[id] ?? id}
                    </span>
                  </div>
                  <span className="text-xs text-text font-mono shrink-0 ml-3">
                    {formatBytes(bytes)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}