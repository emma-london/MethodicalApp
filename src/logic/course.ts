// Wrappers over ringing-lib-ts that produce the row sequences the UI needs.
import { Method, Row } from 'ringing-lib-ts'
import type { CallDefinition } from 'ringing-lib-ts'
import type { MethodDef } from '../data/methods'

export function buildMethod(def: MethodDef): Method {
  return Method.fromPlaceNotation(def.notation, def.stage, def.name)
}

/**
 * The full plain course as a flat list of rows: opening rounds, every row of
 * every lead, and the closing rounds (which equals the opening — it comes round).
 */
export function plainCourseRows(method: Method): Row[] {
  const rounds = Row.rounds(method.stage)
  const rows: Row[] = []
  let start = rounds
  let safety = 0
  do {
    const lead = [...method.leadRows(start)] // start … lead head
    for (let i = 0; i < lead.length - 1; i++) rows.push(lead[i])
    start = lead[lead.length - 1]
    safety++
  } while (!start.isRounds() && safety < 200)
  rows.push(rounds)
  return rows
}

export interface LeadBatch {
  /** The rows produced (not including the starting row). */
  rows: Row[]
  /**
   * Absolute row index -> call label ("Bob" / "Single"), covering each call from
   * the moment it is announced through to the lead-end change it affects. Used
   * to flash the call notification at the right time.
   */
  callsAt: Map<number, string>
  /**
   * Absolute lead-head row index -> call label. One entry per call, at the row
   * where the call takes effect — used to mark it beside the rows list.
   */
  callMarks: Map<number, string>
  /**
   * Absolute row index -> the name of the method about to take over, spanning
   * the lead-end transition. Used to flash the method banner (spliced only).
   */
  methodAt: Map<number, string>
  /**
   * Absolute lead-head row index -> the method of the lead that just finished.
   * Rendered beside the rows, like a call mark (spliced only).
   */
  methodMarks: Map<number, string>
  /**
   * Absolute row index -> the method governing that row's lead, for every row.
   * Lets the meta line show the live current method cheaply (spliced only).
   */
  leadMethodAt: Map<number, string>
  /** The last row produced (a lead head) — the start point for the next batch. */
  endRow: Row
}

/**
 * A candidate method for a spliced session, bundled with its calls and treble
 * offset. A single-element list reproduces plain single-method behaviour.
 */
export interface LeadMethod {
  method: Method
  /** [] for a plain course; standardCalls(method) for a called touch. */
  calls: CallDefinition[]
  /** Blows before the treble's first lead blow that calls are announced. */
  trebleLeadOffset: number
}

/**
 * Generate `numLeads` leads starting immediately after `startRow` (which is not
 * itself included). Each lead independently picks one of `methods` at random
 * (uniform); when that method has calls, its lead end is then chosen at random
 * (weighted towards plain). With a single method and empty calls, every lead is
 * a plain lead of that method — identical to the pre-spliced behaviour.
 *
 * This works from any lead head, so the trainer can extend a session forever by
 * calling it again from the previous `endRow`. Row indices in the returned maps
 * are absolute, offset by `absOffset` (the index of `startRow` in the full list).
 */
export function generateLeads(
  methods: LeadMethod[],
  startRow: Row,
  numLeads: number,
  absOffset: number,
): LeadBatch {
  const spliced = methods.length > 1

  const rows: Row[] = []
  const callsAt = new Map<number, string>()
  const callMarks = new Map<number, string>()
  const methodAt = new Map<number, string>()
  const methodMarks = new Map<number, string>()
  const leadMethodAt = new Map<number, string>()
  let row = startRow
  // Absolute index of the last row emitted so far (startRow sits at absOffset).
  let abs = absOffset

  for (let l = 0; l < numLeads; l++) {
    const lm = methods[Math.floor(Math.random() * methods.length)]
    const { method, calls, trebleLeadOffset } = lm
    const leadStartAbs = abs // this lead's rows run (leadStartAbs, leadHeadAbs]

    // Announce the upcoming method across the lead-end transition (spliced only).
    if (spliced) {
      for (let r = Math.max(0, leadStartAbs - 1); r <= leadStartAbs + 1; r++) {
        methodAt.set(r, method.name)
      }
    }

    const changes = [...method] // the plain lead's changes
    const callBySymbol = new Map(calls.map((c) => [c.symbol, c]))
    const pool = ['.', '.', '.', ...calls.map((c) => c.symbol)]

    const symbol = calls.length ? pool[Math.floor(Math.random() * pool.length)] : '.'
    const call = symbol === '.' ? undefined : callBySymbol.get(symbol)

    // A call replaces the tail changes of the lead with its own.
    const base = changes.slice()
    if (call) {
      const k = call.changes.length
      for (let j = 0; j < k; j++) base[base.length - k + j] = call.changes[j]
    }
    for (const ch of base) {
      row = ch.apply(row)
      abs++
      rows.push(row)
      if (spliced) leadMethodAt.set(abs, method.name)
    }

    const leadHeadAbs = abs // == leadStartAbs + method.leadLength
    if (spliced) methodMarks.set(leadHeadAbs, method.name)

    if (call) {
      callMarks.set(leadHeadAbs, call.name)
      const announce = leadHeadAbs - 1 - trebleLeadOffset
      for (let r = Math.max(0, announce); r <= leadHeadAbs; r++) callsAt.set(r, call.name)
    }
  }

  return { rows, callsAt, callMarks, methodAt, methodMarks, leadMethodAt, endRow: row }
}

/** 0-based place (position, 0 = front/lead) of `bell` in each row. */
export function bellPath(rows: Row[], bell: number): number[] {
  return rows.map((r) => r.toArray().indexOf(bell))
}

/**
 * Name of a place bell by its 1-based place: 1→"1sts", 2→"2nds", 3→"3rds",
 * otherwise "Nths". The place bell a working bell rings for a lead is named by
 * the place it occupies at that lead's head.
 */
export function placeBellName(place: number): string {
  if (place === 1) return '1sts'
  if (place === 2) return '2nds'
  if (place === 3) return '3rds'
  return `${place}ths`
}

/**
 * The place bell `bell` (0-based) rings at each lead head of `rows`, keyed by
 * absolute row index. A lead head sits every `leadLength` rows (row 0 = the
 * course head). The value is the 1-based place the bell occupies there — i.e.
 * the place bell it rings for the lead beginning at that row. The final row is
 * the course coming round (a repeat of row 0) and is omitted.
 */
export function placeBellsAt(
  rows: Row[],
  bell: number,
  leadLength: number,
): Map<number, number> {
  const out = new Map<number, number>()
  if (leadLength <= 0) return out
  for (let i = 0; i < rows.length; i += leadLength) {
    if (i === rows.length - 1) continue // final rounds — same as row 0
    out.set(i, rows[i].toArray().indexOf(bell) + 1)
  }
  return out
}
