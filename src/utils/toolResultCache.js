// Generic per-tool result cache backed by IndexedDB.
//
// Lets someone bounce between tools (e.g. WHOIS Lookup -> DNS Lookup -> back
// to WHOIS Lookup) without having to re-run the same query — each tool's
// last result sticks around until a new query overwrites it or it's cleared
// explicitly. Storage is scoped per tool via TOOL_CACHE_KEYS, so tools never
// clobber each other's cache.
//
// This used to live in localStorage, but localStorage is capped at roughly
// 5-10MB *shared across the entire origin* and throws synchronously the
// moment it's full — a poor fit once tool results (a full RDAP dump, a large
// DNS record set, etc.) start adding up. IndexedDB has a much larger
// practical quota (typically hundreds of MB to GBs, browser-dependent) and
// stores structured data natively, so every read/write below is async.
//
// To wire up a new tool:
//   1. Add a unique id to TOOL_CACHE_KEYS below.
//   2. On a successful query: await saveToolCache(TOOL_CACHE_KEYS.MY_TOOL, { ...any state you want restored })
//   3. On mount, inside a useEffect (with an async helper function since the
//      effect callback itself can't be async): await loadToolCache(TOOL_CACHE_KEYS.MY_TOOL)
//      once and, if it returns non-null, use it to hydrate initial state
//      instead of the empty/default state.
//   4. Optionally: await clearToolCache(TOOL_CACHE_KEYS.MY_TOOL) if the tool
//      has a "clear results" action.

const DB_NAME = 'rivo-tool-cache'
const DB_VERSION = 1
const STORE_NAME = 'toolCache'
const CACHE_VERSION = 1

// The localStorage key prefix this cache used before it moved to IndexedDB.
// Kept only so loadToolCache can transparently migrate anything left over
// from before the switch — no new writes ever touch localStorage again.
const LEGACY_STORAGE_PREFIX = 'rivo:toolCache:'

// Register every tool that persists results here. Keeping this as a single
// registry (rather than free-form strings scattered across pages) avoids
// silent key collisions between tools.
export const TOOL_CACHE_KEYS = {
  WHOIS_LOOKUP: 'whoisLookup',
  DNS_LOOKUP: 'dnsLookup',
  FRAMEWORK_DETECTOR: 'frameworkDetector',
  PAGESPEED_INSIGHTS: 'pageSpeedInsights',
}

export const TOOL_CACHE_LABELS = {
  [TOOL_CACHE_KEYS.WHOIS_LOOKUP]: 'WHOIS Lookup',
  [TOOL_CACHE_KEYS.DNS_LOOKUP]: 'DNS Lookup',
  [TOOL_CACHE_KEYS.FRAMEWORK_DETECTOR]: 'Framework Detector',
  [TOOL_CACHE_KEYS.PAGESPEED_INSIGHTS]: 'PageSpeed Insights',
}

let dbPromise = null

// Opens (and caches) the single shared IndexedDB connection used by this
// module. On failure, clears the cached promise so a later call can retry
// instead of every future call being permanently stuck on one failure.
function openDb() {
  if (dbPromise) return dbPromise

  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this environment'))
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'toolId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch(err => {
    dbPromise = null
    throw err
  })

  return dbPromise
}

// Runs `fn(store)` inside a transaction of the given mode and resolves with
// the underlying IDBRequest's result once the transaction completes.
function withStore(mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const request = fn(store)

    tx.oncomplete = () => resolve(request?.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  }))
}

// One-time best-effort migration of a tool's old localStorage entry (if any)
// into IndexedDB, run lazily the first time that tool's cache is loaded.
// Silently no-ops if there's nothing to migrate or localStorage is unavailable.
function migrateLegacyEntry(toolId) {
  try {
    const raw = window.localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${toolId}`)
    window.localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}${toolId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.v !== CACHE_VERSION) return null
    return parsed.data ?? null
  } catch {
    return null
  }
}

// Utility to convert raw byte count to readable string (e.g. 1.2 KB, 450 B)
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// Estimates byte size of an object in IndexedDB by serializing to JSON
function estimateRecordSize(record) {
  try {
    const str = JSON.stringify(record)
    return new TextEncoder().encode(str).length
  } catch {
    return 0
  }
}

// Persists `data` (any structured-cloneable shape) as the last result for
// `toolId`. Silently no-ops on failure (IndexedDB unavailable, private
// browsing restrictions, quota exceeded, etc.) — caching is a convenience
// and should never break the tool it's attached to.
export async function saveToolCache(toolId, data) {
  try {
    const record = { toolId, v: CACHE_VERSION, savedAt: Date.now(), data }
    await withStore('readwrite', store => store.put(record))
  } catch {
    // ignore
  }
}

// Returns the last saved `data` for `toolId`, or null if there isn't one,
// it failed to read, or it was written by an older cache version.
export async function loadToolCache(toolId) {
  try {
    const record = await withStore('readonly', store => store.get(toolId))
    if (record && record.v === CACHE_VERSION) return record.data ?? null

    // Nothing in IndexedDB yet — fall back to (and migrate) any entry left
    // over from before this cache moved off localStorage.
    const migrated = migrateLegacyEntry(toolId)
    if (migrated !== null) {
      await saveToolCache(toolId, migrated)
      return migrated
    }
    return null
  } catch {
    return null
  }
}

// Removes the cached result for `toolId`, if any.
export async function clearToolCache(toolId) {
  try {
    await withStore('readwrite', store => store.delete(toolId))
  } catch {
    // ignore
  }
}

export async function listCachedToolIds() {
  try {
    const keys = await withStore('readonly', store => store.getAllKeys())
    return keys || []
  } catch {
    return []
  }
}

/**
 * Returns an array of cached entries with their estimated byte sizes:
 * [{ id: 'whoisLookup', bytes: 1420 }, ...]
 */
export async function getCachedToolDetails() {
  try {
    const records = await withStore('readonly', store => store.getAll())
    if (!records) return []

    return records.map(record => ({
      id: record.toolId,
      bytes: estimateRecordSize(record),
    }))
  } catch {
    return []
  }
}

// Clears the cached result for a specific set of tool ids in a single
// transaction (used when a person picks a subset of tools to clear rather
// than everything). Silently no-ops for ids that don't have an entry.
// Returns true on success, false if the operation failed outright.
export async function clearToolCaches(toolIds) {
  if (!toolIds || toolIds.length === 0) return true
  try {
    await withStore('readwrite', store => {
      let lastRequest = null
      toolIds.forEach(id => { lastRequest = store.delete(id) })
      return lastRequest
    })
    return true
  } catch {
    return false
  }
}

// Clears every tool's cached result at once (used by Settings -> "Clear
// Tool Cache"). Only touches the dedicated toolCache IndexedDB object store,
// so this can never affect unrelated storage — most importantly the
// "rivo-theme" key, which lives in localStorage under a completely
// different name/mechanism and is never read or written by this file.
// Returns true on success, false if clearing failed outright.
export async function clearAllToolCaches() {
  try {
    await withStore('readwrite', store => store.clear())
    return true
  } catch {
    return false
  }
}