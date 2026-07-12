// Curated spliced-method sets. A "spliced" session rings a touch that switches
// method at each lead end, choosing from one of these named groups.
//
// Every method name here must resolve in METHODS (i.e. it must be present in the
// library's STANDARD_SET); the sets reference the single source of truth rather
// than re-declaring notation. All methods in a set share one stage — that is the
// only hard requirement for splicing (see docs/design/spliced-methods.md).
import { METHODS } from './methods'

export interface SpliceSet {
  /** Display name of the group, e.g. "Standard 8 Surprise Major". */
  name: string
  /** Shared stage of every method in the set. */
  stage: number
  /** Method names, each resolvable in the method catalog. */
  methods: string[]
  /** True for user-created sets (persisted in localStorage), absent for built-ins. */
  custom?: boolean
}

// The famous group: all-the-work spliced, one lead of each of the eight standard
// surprise major methods, all sharing Plain Bob lead heads.
const STANDARD_8_SURPRISE_MAJOR: SpliceSet = {
  name: 'Standard 8 Surprise Major',
  stage: 8,
  methods: [
    'Cambridge Surprise Major',
    'Yorkshire Surprise Major',
    'Superlative Surprise Major',
    'Lincolnshire Surprise Major',
    'Rutland Surprise Major',
    'Pudsey Surprise Major',
    'Bristol Surprise Major',
    'London Surprise Major',
  ],
}

// Horton's 4 - a challenging Surprise Major selection
const HORTONS_4_SURPRISE_MAJOR: SpliceSet = {
  name: 'Horton\'s 4 Surprise Major',
  stage: 8,
  methods: [
    'Bristol Surprise Major',
	'London Surprise Major',
	'Belfast Surprise Major',
	'Glasgow Surprise Major',
  ],
}

// A classic introductory pair — Kent and Oxford Treble Bob are commonly spliced
// together as a first taste of changing method.
const KENT_OXFORD_TREBLE_BOB_MAJOR: SpliceSet = {
  name: 'Kent & Oxford Treble Bob Major',
  stage: 8,
  methods: ['Kent Treble Bob Major', 'Oxford Treble Bob Major'],
}

const SURPRISE_MINOR: SpliceSet = {
  name: 'Surprise Minor (Cambridge group)',
  stage: 6,
  methods: [
    'Cambridge Surprise Minor',
    'Ipswich Surprise Minor',
    'Norwich Surprise Minor',
    'London Surprise Minor',
  ],
}

const SURPRISE_ROYAL: SpliceSet = {
  name: 'Cambridge & Yorkshire Surprise Royal',
  stage: 10,
  methods: ['Cambridge Surprise Royal', 'Yorkshire Surprise Royal'],
}

const SURPRISE_MAXIMUS: SpliceSet = {
  name: 'Bristol & Cambridge Surprise Maximus',
  stage: 12,
  methods: ['Bristol Surprise Maximus', 'Cambridge Surprise Maximus'],
}

const ALL: SpliceSet[] = [
  STANDARD_8_SURPRISE_MAJOR,
  HORTONS_4_SURPRISE_MAJOR,
  KENT_OXFORD_TREBLE_BOB_MAJOR,
  SURPRISE_MINOR,
  SURPRISE_ROYAL,
  SURPRISE_MAXIMUS,
]

// Keep only sets whose methods are all present in the current library set, so a
// dropped/renamed library method can never surface a broken preset. Warn in dev
// if a set is filtered out.
const known = new Set(METHODS.map((m) => m.name))
export const SPLICE_SETS: SpliceSet[] = ALL.filter((set) => {
  const missing = set.methods.filter((n) => !known.has(n))
  if (missing.length) {
    if (import.meta.env?.DEV) {
      console.warn(`Splice set "${set.name}" hidden — missing methods: ${missing.join(', ')}`)
    }
    return false
  }
  return true
})
