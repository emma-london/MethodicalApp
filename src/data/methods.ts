// The app's method list is sourced directly from the library's bundled
// STANDARD_SET — the single source of truth. We deliberately keep no local copy
// here so the list can never go stale: when the library's standard set grows
// (and a new version is published), this app picks it up on the next dependency
// bump.
//
// STANDARD_SET is a separate subpath export (not part of the root entry point):
// ~45 real methods resolved at build time from the CCCBR snapshot. It is
// distinct from the root's STANDARD_METHODS — a small hand-verified truth corpus
// (~10 methods) whose root re-export is deprecated since library 1.2.0 (removal
// in 2.0.0); STANDARD_SET is the intended source for application method lists.
// See ADR-0015 / ADR-0019 / ADR-0020 in the library.
import { STANDARD_SET } from 'ringing-lib-ts/data/standard-set'

export interface MethodDef {
  name: string
  stage: number
  notation: string
  classification: string
}

// Present the library's set sorted by stage, then by name, for a tidy dropdown.
export const METHODS: MethodDef[] = [...STANDARD_SET]
  .map((m) => ({
    name: m.name,
    stage: m.stage,
    notation: m.notation,
    classification: m.classification,
  }))
  .sort((a, b) => a.stage - b.stage || a.name.localeCompare(b.name))

// Distinct stages present in the current method list, ascending.
export const STAGES: number[] = [...new Set(METHODS.map((m) => m.stage))].sort(
  (a, b) => a - b,
)

export const STAGE_NAMES: Record<number, string> = {
  4: 'Minimus', 5: 'Doubles', 6: 'Minor', 7: 'Triples',
  8: 'Major', 9: 'Caters', 10: 'Royal', 11: 'Cinques', 12: 'Maximus',
}
