// The method catalog: the app's runtime, extensible view over methods.
//
// It layers three tiers (see docs/design/full-library-integration.md):
//   1. standard — the always-bundled STANDARD_SET baseline.
//   2. used     — methods the ringer has selected before, persisted in
//                 localStorage and shown inline in the picker alongside (1).
//   3. loaded   — full CCCBR files fetched at runtime, transient (in-memory),
//                 reached only via the search screen — never inline in the picker.
//
// The picker renders (1) ∪ (2). Tier 3 is searched on demand; a method graduates
// to tier 2 the moment it's used, which is also what makes it survive a reload
// (and work offline) without any file cache.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { METHODS, entryToMethodDef, methodKey } from '../data/methods'
import type { MethodDef } from '../data/methods'
import type { CccbrFileClass, LibraryProvenance } from 'ringing-lib-ts/cccbr-methods'

const USED_KEY = 'methodical.usedMethods.v1'

// Keys of the baseline set, so we never store a standard method as "used" (it's
// already tier 1) and never show it twice.
const STANDARD_KEYS = new Set(METHODS.map(methodKey))

export type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

export interface LoadedSet {
  methods: MethodDef[]
  provenance: LibraryProvenance
}

const setKey = (fileClass: CccbrFileClass, stage: number) => `${fileClass}/${stage}`

interface CatalogValue {
  /** Standard ∪ used, de-duped — what the picker dropdown shows. */
  pickerMethods: MethodDef[]
  /** Distinct stages present in pickerMethods, ascending. */
  stages: number[]
  /** Resolve a method by name across all three tiers (for the active selection). */
  findMethod: (name: string) => MethodDef | undefined
  /** Promote a method to tier 2 (used) — persisted; no-op for standard methods. */
  remember: (m: MethodDef) => void
  /** Whether any CCCBR set has been loaded this session. */
  hasLoaded: boolean
  /** Flat, de-duped list of every loaded method — the search corpus. */
  loadedMethods: MethodDef[]
  /** Loaded sets keyed by `${fileClass}/${stage}`. */
  loaded: Map<string, LoadedSet>
  /** Fetch one CCCBR (file-class, stage) file and add it to the loaded tier. */
  load: (fileClass: CccbrFileClass, stage: number) => Promise<void>
  /** Load state for one (file-class, stage). */
  loadStateFor: (fileClass: CccbrFileClass, stage: number) => LoadState
  /** Human-readable message from the most recent failed load, if any. */
  loadError: string | null
}

const CatalogContext = createContext<CatalogValue | null>(null)

function loadUsed(): MethodDef[] {
  try {
    const raw = localStorage.getItem(USED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Keep only well-formed entries that aren't part of the standard baseline.
    return parsed.filter(
      (m): m is MethodDef =>
        m &&
        typeof m.name === 'string' &&
        typeof m.stage === 'number' &&
        typeof m.notation === 'string' &&
        !STANDARD_KEYS.has(methodKey(m)),
    )
  } catch {
    return []
  }
}

function describeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/RangeError/.test(String(e)) || e instanceof RangeError) {
    return 'CCCBR publishes no file for that class and stage.'
  }
  return `Couldn't reach CCCBR (${msg}). Showing the methods you already have.`
}

export function MethodCatalogProvider({ children }: { children: ReactNode }) {
  const [used, setUsed] = useState<MethodDef[]>(() => loadUsed())
  const [loaded, setLoaded] = useState<Map<string, LoadedSet>>(new Map())
  const [loadStates, setLoadStates] = useState<Record<string, LoadState>>({})
  const [loadError, setLoadError] = useState<string | null>(null)

  // Persist the used tier whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(USED_KEY, JSON.stringify(used))
    } catch {
      // ignore write failures (private mode, quota, etc.)
    }
  }, [used])

  const pickerMethods = useMemo(() => {
    // Standard first (curated), then any used methods not already present.
    const seen = new Set(STANDARD_KEYS)
    const merged = [...METHODS]
    for (const m of used) {
      const key = methodKey(m)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(m)
    }
    return merged.sort((a, b) => a.stage - b.stage || a.name.localeCompare(b.name))
  }, [used])

  const stages = useMemo(
    () => [...new Set(pickerMethods.map((m) => m.stage))].sort((a, b) => a - b),
    [pickerMethods],
  )

  const loadedMethods = useMemo(() => {
    const seen = new Set<string>()
    const out: MethodDef[] = []
    for (const set of loaded.values()) {
      for (const m of set.methods) {
        const key = methodKey(m)
        if (seen.has(key)) continue
        seen.add(key)
        out.push(m)
      }
    }
    return out
  }, [loaded])

  // Name → method across all tiers, so a just-searched (not-yet-remembered)
  // method still resolves as the active selection.
  const byName = useMemo(() => {
    const map = new Map<string, MethodDef>()
    for (const m of loadedMethods) map.set(m.name, m)
    for (const m of used) map.set(m.name, m)
    for (const m of METHODS) map.set(m.name, m)
    return map
  }, [used, loadedMethods])

  const findMethod = useCallback((name: string) => byName.get(name), [byName])

  const remember = useCallback((m: MethodDef) => {
    const key = methodKey(m)
    if (STANDARD_KEYS.has(key)) return
    setUsed((prev) =>
      prev.some((u) => methodKey(u) === key) ? prev : [...prev, { ...m }],
    )
  }, [])

  const load = useCallback(async (fileClass: CccbrFileClass, stage: number) => {
    const key = setKey(fileClass, stage)
    setLoadError(null)
    setLoadStates((prev) => ({ ...prev, [key]: 'loading' }))
    try {
      const mod = await import('ringing-lib-ts/cccbr-methods')
      const { library, provenance } = await mod.loadMethods(fileClass, stage)
      const methods = [...library].map((e) => entryToMethodDef(e, 'cccbr'))
      setLoaded((prev) => new Map(prev).set(key, { methods, provenance }))
      setLoadStates((prev) => ({ ...prev, [key]: 'loaded' }))
    } catch (e) {
      setLoadStates((prev) => ({ ...prev, [key]: 'error' }))
      setLoadError(describeError(e))
    }
  }, [])

  const loadStateFor = useCallback(
    (fileClass: CccbrFileClass, stage: number) =>
      loadStates[setKey(fileClass, stage)] ?? 'idle',
    [loadStates],
  )

  const value: CatalogValue = {
    pickerMethods,
    stages,
    findMethod,
    remember,
    hasLoaded: loaded.size > 0,
    loadedMethods,
    loaded,
    load,
    loadStateFor,
    loadError,
  }

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useMethodCatalog(): CatalogValue {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useMethodCatalog must be used within MethodCatalogProvider')
  return ctx
}
