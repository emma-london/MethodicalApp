// User-created spliced sets, persisted in localStorage and merged with the
// built-in SPLICE_SETS. Kept as a tiny module store (not React context) so the
// picker and the trainer stay in sync via useSyncExternalStore without adding
// another provider — mirroring how the "used methods" tier persists.
import { useMemo, useSyncExternalStore } from 'react'
import { SPLICE_SETS } from '../data/spliceSets'
import type { SpliceSet } from '../data/spliceSets'

const KEY = 'methodical.spliceSets.v1'

function isValidSet(s: unknown): s is SpliceSet {
  const o = s as Record<string, unknown>
  return (
    !!o &&
    typeof o.name === 'string' &&
    typeof o.stage === 'number' &&
    Array.isArray(o.methods) &&
    o.methods.every((m) => typeof m === 'string')
  )
}

function load(): SpliceSet[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isValidSet)
      .map((s) => ({ name: s.name, stage: s.stage, methods: [...s.methods], custom: true as const }))
  } catch {
    return []
  }
}

let custom: SpliceSet[] = load()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function persist() {
  try {
    // Store only the data fields; `custom` is re-applied on load.
    localStorage.setItem(
      KEY,
      JSON.stringify(custom.map(({ name, stage, methods }) => ({ name, stage, methods }))),
    )
  } catch {
    // ignore write failures (private mode, quota, etc.)
  }
}

/** True if a name already belongs to a built-in or existing custom set. */
export function spliceSetNameTaken(name: string): boolean {
  const n = name.trim().toLowerCase()
  return [...SPLICE_SETS, ...custom].some((s) => s.name.toLowerCase() === n)
}

/** Add (or replace by name, custom-only) a user set and select it. */
export function addSpliceSet(set: { name: string; stage: number; methods: string[] }) {
  const clean: SpliceSet = {
    name: set.name.trim(),
    stage: set.stage,
    methods: [...set.methods],
    custom: true,
  }
  custom = [...custom.filter((s) => s.name !== clean.name), clean]
  persist()
  emit()
}

export function removeSpliceSet(name: string) {
  const before = custom.length
  custom = custom.filter((s) => s.name !== name)
  if (custom.length !== before) {
    persist()
    emit()
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return custom
}

/** The user's custom sets (reactive). */
export function useCustomSpliceSets(): SpliceSet[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Built-in sets followed by the user's custom sets (reactive). */
export function useSpliceSets(): { all: SpliceSet[]; builtIn: SpliceSet[]; custom: SpliceSet[] } {
  const customSets = useCustomSpliceSets()
  const all = useMemo(() => [...SPLICE_SETS, ...customSets], [customSets])
  return { all, builtIn: SPLICE_SETS, custom: customSets }
}
