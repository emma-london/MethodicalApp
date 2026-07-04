// Wrappers over ringing-lib-ts that produce the row sequences the UI needs.
import { Method, Row, Composition, Touch, standardCalls } from 'ringing-lib-ts'
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

export interface TouchResult {
  rows: Row[]
  calling: string
  /**
   * Row index -> call label ("Bob" / "Single"), covering each call from the
   * moment it is announced through to the lead-end change it affects. Used to
   * flash a notification in the trainer at the right time.
   */
  callsAt: Map<number, string>
  /**
   * Lead-head row index -> call label. One entry per call, at the row where the
   * call takes effect — used to mark the call beside the rows list, as a
   * written composition would.
   */
  callMarks: Map<number, string>
}

export interface TouchOptions {
  leads?: number
  /**
   * How many rows before the treble's first blow in lead the call is announced.
   * 0 for most methods (the conductor calls as the treble makes its first blow
   * in lead); 2 for Grandsire, where the affected work starts two blows earlier.
   */
  trebleLeadOffset?: number
}

/**
 * Generate a randomly-called touch of `leads` leads. Calls are chosen from the
 * method's standard calls; for now this is random, not a real composition —
 * loading a real composition is a future enhancement.
 */
export function randomTouchRows(method: Method, opts: TouchOptions = {}): TouchResult {
  const { leads = 8, trebleLeadOffset = 0 } = opts
  let calls: CallDefinition[]
  try {
    calls = standardCalls(method)
  } catch {
    calls = []
  }
  const nameBySymbol = new Map(calls.map((c) => [c.symbol, c.name]))
  const symbols = calls.map((c) => c.symbol)
  // Weight towards plain leads so a touch still resembles the method.
  const pool = ['.', '.', '.', ...symbols]
  let calling = ''
  for (let i = 0; i < leads; i++) {
    calling += pool[Math.floor(Math.random() * pool.length)]
  }
  const composition = Composition.fromCalling(method, calling, { calls })
  const rows = new Touch(composition).toArray()

  // A call on lead L affects the change into that lead's lead head
  // (row index (L+1)*leadLength). It is announced as the treble makes its first
  // blow in lead — the row just before that lead head — offset earlier for
  // Grandsire. We flag the rows from the announcement through the lead head so
  // the notification stays visible across the affected change.
  const leadLength = method.leadLength
  const callsAt = new Map<number, string>()
  const callMarks = new Map<number, string>()
  for (let lead = 0; lead < calling.length; lead++) {
    const symbol = calling[lead]
    const name = nameBySymbol.get(symbol)
    if (symbol === '.' || name === undefined) continue
    const leadHeadRow = (lead + 1) * leadLength
    const announceRow = leadHeadRow - 1 - trebleLeadOffset
    for (let r = Math.max(0, announceRow); r <= leadHeadRow && r < rows.length; r++) {
      callsAt.set(r, name)
    }
    if (leadHeadRow < rows.length) callMarks.set(leadHeadRow, name)
  }
  return { rows, calling, callsAt, callMarks }
}

/** 0-based place (position, 0 = front/lead) of `bell` in each row. */
export function bellPath(rows: Row[], bell: number): number[] {
  return rows.map((r) => r.toArray().indexOf(bell))
}
