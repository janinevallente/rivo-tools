// Generic per-tool result cache backed by localStorage.
//
// Lets someone bounce between tools (e.g. WHOIS Lookup -> DNS Lookup -> back
// to WHOIS Lookup) without having to re-run the same query — each tool's
// last result sticks around until a new query overwrites it or it's cleared
// explicitly. Storage is scoped per tool via TOOL_CACHE_KEYS, so tools never
// clobber each other's cache.
//
// To wire up a new tool:
//   1. Add a unique id to TOOL_CACHE_KEYS below.
//   2. On a successful query, call saveToolCache(TOOL_CACHE_KEYS.MY_TOOL, { ...any state you want restored })
//   3. On mount, call loadToolCache(TOOL_CACHE_KEYS.MY_TOOL) once and, if it
//      returns non-null, use it to hydrate initial state instead of the
//      empty/default state.
//   4. Optionally call clearToolCache(TOOL_CACHE_KEYS.MY_TOOL) if the tool
//      has a "clear results" action.

const STORAGE_PREFIX = 'rivo:toolCache:'
const CACHE_VERSION = 1

// Register every tool that persists results here. Keeping this as a single
// registry (rather than free-form strings scattered across pages) avoids
// silent key collisions between tools.
export const TOOL_CACHE_KEYS = {
  WHOIS_LOOKUP: 'whoisLookup',
  DNS_LOOKUP: 'dnsLookup',
}

function storageKey(toolId) {
  return `${STORAGE_PREFIX}${toolId}`
}

// Persists `data` (any JSON-serialisable shape) as the last result for `toolId`.
// Silently no-ops on failure (private browsing, storage quota, SSR, etc.) —
// caching is a convenience and should never break the tool it's attached to.
export function saveToolCache(toolId, data) {
  try {
    const payload = { v: CACHE_VERSION, savedAt: Date.now(), data }
    window.localStorage.setItem(storageKey(toolId), JSON.stringify(payload))
  } catch {
    // ignore — see comment above
  }
}

// Returns the last saved `data` for `toolId`, or null if there isn't one,
// it failed to parse, or it was written by an older cache version.
export function loadToolCache(toolId) {
  try {
    const raw = window.localStorage.getItem(storageKey(toolId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.v !== CACHE_VERSION) return null
    return parsed.data ?? null
  } catch {
    return null
  }
}

// Removes the cached result for `toolId`, if any.
export function clearToolCache(toolId) {
  try {
    window.localStorage.removeItem(storageKey(toolId))
  } catch {
    // ignore
  }
}