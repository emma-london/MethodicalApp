// A curated subset of common methods across stages, in ringing-lib-ts
// place-notation form. Grows over time; the full CCCBR library can be
// bundled later as generated app data (see README).
import { Stage } from 'ringing-lib-ts'

export interface MethodDef {
  name: string
  stage: number
  notation: string
  classification: string
}

export const METHODS: MethodDef[] = [
  // Minimus (4)
  { name: 'Plain Bob Minimus', stage: Stage.MINIMUS, notation: '&-14-14,12', classification: 'Bob' },

  // Doubles (5)
  { name: 'Plain Bob Doubles', stage: Stage.DOUBLES, notation: '&5.1.5.1.5,125', classification: 'Bob' },
  { name: 'Grandsire Doubles', stage: Stage.DOUBLES, notation: '3.1.5.1.5.1.5.1.5.1', classification: 'Place' },
  { name: 'Reverse Canterbury Pleasure Place Doubles', stage: Stage.DOUBLES, notation: '&5.1.5.36.5,125', classification: 'Place' },

  // Minor (6)
  { name: 'Plain Bob Minor', stage: Stage.MINOR, notation: '&-16-16-16,12', classification: 'Bob' },
  { name: 'St Clement’s College Bob Minor', stage: Stage.MINOR, notation: '&-18-18-56,12', classification: 'Bob' },
  { name: 'Cambridge Surprise Minor', stage: Stage.MINOR, notation: '&-36-14-12-36-14-56,12', classification: 'Surprise' },
  { name: 'Kent Treble Bob Minor', stage: Stage.MINOR, notation: '&34-34.16-12-16-12-16,16', classification: 'Treble Bob' },

  // Triples (7)
  { name: 'Plain Bob Triples', stage: Stage.TRIPLES, notation: '&7.1.7.1.7.1.7,127', classification: 'Bob' },
  { name: 'Grandsire Triples', stage: Stage.TRIPLES, notation: '3.1.7.1.7.1.7.1.7.1.7.1.7.1', classification: 'Place' },
  { name: 'Stedman Triples', stage: Stage.TRIPLES, notation: '3.1.7.3.1.3,1', classification: 'Principle' },

  // Major (8)
  { name: 'Plain Bob Major', stage: Stage.MAJOR, notation: '&-18-18-18-18,12', classification: 'Bob' },
  { name: 'Little Bob Major', stage: Stage.MAJOR, notation: '&-18-12-18,12', classification: 'Bob' },
  { name: 'Double Norwich Court Bob Major', stage: Stage.MAJOR, notation: '&-14-58-16-78-14-58-16-78,18', classification: 'Bob' },
  { name: 'Cambridge Surprise Major', stage: Stage.MAJOR, notation: '&-38-14-1258-36-14-58-16-78,12', classification: 'Surprise' },
  { name: 'Yorkshire Surprise Major', stage: Stage.MAJOR, notation: '&-38-14-58-16-12-38-14-78,12', classification: 'Surprise' },

  // Royal (10)
  { name: 'Plain Bob Royal', stage: Stage.ROYAL, notation: '&-10-10-10-10-10,12', classification: 'Bob' },
  { name: 'Cambridge Surprise Royal', stage: Stage.ROYAL, notation: '&-30-14-1250-36-1470-58-16-70-18-90,12', classification: 'Surprise' },
]

export const STAGE_NAMES: Record<number, string> = {
  4: 'Minimus', 5: 'Doubles', 6: 'Minor', 7: 'Triples',
  8: 'Major', 9: 'Caters', 10: 'Royal', 11: 'Cinques', 12: 'Maximus',
}
