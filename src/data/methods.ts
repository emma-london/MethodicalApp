// The app's *baseline* method list is sourced directly from the library's bundled
// STANDARD_SET — the single source of truth for the common case. We deliberately
// keep no local copy here so the list can never go stale: when the library's
// standard set grows (and a new version is published), this app picks it up on
// the next dependency bump.
//
// STANDARD_SET is a separate subpath export (not part of the root entry point):
// ~45 real methods resolved at build time from the CCCBR snapshot. It is
// distinct from the root's STANDARD_METHODS — a small hand-verified truth corpus
// (~10 methods) whose root re-export is deprecated since library 1.2.0 (removal
// in 2.0.0); STANDARD_SET is the intended source for application method lists.
// See ADR-0015 / ADR-0019 / ADR-0020 in the library.
//
// The full CCCBR library (fetched at runtime for power users) is layered *on top*
// of this baseline by the method catalog store (see state/MethodCatalog.tsx and
// docs/design/full-library-integration.md), not here.
import { STANDARD_SET } from 'ringing-lib-ts/data/standard-set'
import type { MethodLibraryEntry } from 'ringing-lib-ts'

// Where a MethodDef came from — 'standard' is the always-bundled baseline;
// 'cccbr' is a method fetched from the live CCCBR library at runtime.
export type MethodSource = 'standard' | 'cccbr'

export interface MethodDef {
  name: string
  stage: number
  notation: string
  classification: string
  /** CCCBR method id, when known — the stable de-dupe key across sources. */
  id?: number
  source?: MethodSource
}

// Map a library MethodLibraryEntry (bundled or fetched) into the app's lean view
// type. The single place the two shapes meet, reused by the catalog store.
export function entryToMethodDef(
  entry: MethodLibraryEntry,
  source: MethodSource,
): MethodDef {
  return {
    name: entry.name,
    stage: entry.stage,
    notation: entry.notation,
    classification: entry.classification,
    id: entry.id,
    source,
  }
}

// Present the library's set sorted by stage, then by name, for a tidy dropdown.
export const METHODS: MethodDef[] = [...STANDARD_SET]
  .map((m) => entryToMethodDef(m, 'standard'))
  .sort((a, b) => a.stage - b.stage || a.name.localeCompare(b.name))

// Distinct stages present in the baseline method list, ascending.
export const STAGES: number[] = [...new Set(METHODS.map((m) => m.stage))].sort(
  (a, b) => a - b,
)

export const STAGE_NAMES: Record<number, string> = {
  4: 'Minimus', 5: 'Doubles', 6: 'Minor', 7: 'Triples',
  8: 'Major', 9: 'Caters', 10: 'Royal', 11: 'Cinques', 12: 'Maximus',
  13: 'Sextuples', 14: 'Fourteen', 15: 'Septuples', 16: 'Sixteen',
}

// A stable de-dupe key: prefer the CCCBR id, fall back to name+stage.
export function methodKey(m: MethodDef): string {
  return m.id != null ? `id:${m.id}` : `${m.name}|${m.stage}`
}
