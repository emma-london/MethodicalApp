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
  /** The last row produced (a lead head) — the start point for the next batch. */
  endRow: Row
}

/**
 * Generate `numLeads` leads starting immediately after `startRow` (which is not
 * itself included). When `calls` is non-empty each lead end is chosen at random
 * (weighted towards plain); with an empty `calls` array every lead is plain.
 *
 * This works from any lead head, so the trainer can extend a session forever by
 * calling it again from the previous `endRow`. Row indices in the returned maps
 * are absolute, offset by `absOffset` (the index of `startRow` in the full list).
 */
export function generateLeads(
  method: Method,
  startRow: Row,
  numLeads: number,
  calls: CallDefinition[],
  trebleLeadOffset: number,
  absOffset: number,
): LeadBatch {
  const leadLength = method.leadLength
  const changes = [...method] // the plain lead's changes
  const callBySymbol = new Map(calls.map((c) => [c.symbol, c]))
  const pool = ['.', '.', '.', ...calls.map((c) => c.symbol)]

  const rows: Row[] = []
  const callsAt = new Map<number, string>()
  const callMarks = new Map<number, string>()
  let row = startRow

  for (let l = 0; l < numLeads; l++) {
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
      rows.push(row)
    }

    if (call) {
      const leadHeadAbs = absOffset + (l + 1) * leadLength
      callMarks.set(leadHeadAbs, call.name)
      const announce = leadHeadAbs - 1 - trebleLeadOffset
      for (let r = Math.max(0, announce); r <= leadHeadAbs; r++) callsAt.set(r, call.name)
    }
  }

  return { rows, callsAt, callMarks, endRow: row }
}

/** 0-based place (position, 0 = front/lead) of `bell` in each row. */
export function bellPath(rows: Row[], bell: number): number[] {
  return rows.map((r) => r.toArray().indexOf(bell))
}
