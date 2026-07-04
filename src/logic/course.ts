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
}

/**
 * Generate a randomly-called touch of `leads` leads. Calls are chosen from the
 * method's standard calls; for now this is random, not a real composition —
 * loading a real composition is a future enhancement.
 */
export function randomTouchRows(method: Method, leads = 8): TouchResult {
  let calls: CallDefinition[]
  try {
    calls = standardCalls(method)
  } catch {
    calls = []
  }
  const symbols = calls.map((c) => c.symbol)
  // Weight towards plain leads so a touch still resembles the method.
  const pool = ['.', '.', '.', ...symbols]
  let calling = ''
  for (let i = 0; i < leads; i++) {
    calling += pool[Math.floor(Math.random() * pool.length)]
  }
  const composition = Composition.fromCalling(method, calling, { calls })
  const rows = new Touch(composition).toArray()
  return { rows, calling }
}

/** 0-based place (position, 0 = front/lead) of `bell` in each row. */
export function bellPath(rows: Row[], bell: number): number[] {
  return rows.map((r) => r.toArray().indexOf(bell))
}
