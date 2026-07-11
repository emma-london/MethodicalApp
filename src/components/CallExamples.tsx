import { useMemo } from 'react'
import type { Method, CallDefinition } from 'ringing-lib-ts'
import { bellToChar, standardCalls } from 'ringing-lib-ts'
import { callExampleRows } from '../logic/course'
import Blueline from './Blueline'

interface Props {
  method: Method
  stage: number
  workingBell: number // 0-based
  view: 'numbers' | 'blueline'
  rowHeight: number
  textSize: number
}

// Context shown around the lead end where the call is made.
const ROWS_BEFORE = 8
const ROWS_AFTER = 5

function safeStandardCalls(m: Method): CallDefinition[] {
  try {
    return standardCalls(m)
  } catch {
    return []
  }
}

/**
 * A "Bobs & Singles" panel: for each of the method's bob and single, show the
 * rows around the end of the *first* lead as if that call were made there —
 * eight rows of plain context before the lead end, then five after.
 */
export default function CallExamples({ method, stage, workingBell, view, rowHeight, textSize }: Props) {
  const calls = useMemo(() => safeStandardCalls(method), [method])

  const examples = useMemo(() => {
    const bob = calls.find((c) => /bob/i.test(c.name))
    const single = calls.find((c) => /single/i.test(c.name))
    return [
      bob ? { label: 'Bob', call: bob } : null,
      single ? { label: 'Single', call: single } : null,
    ].filter((x): x is { label: string; call: CallDefinition } => x !== null)
  }, [calls])

  if (examples.length === 0) return null

  // Keep the example numbers from getting unwieldy when the main text size is large.
  const exampleFont = Math.min(textSize, 20)

  return (
    <section className="call-examples">
      <h3 className="call-examples__title">Bobs &amp; Singles</h3>
      <p className="call-examples__note">
        Called at the end of the first lead — {ROWS_BEFORE} rows before the lead end and {ROWS_AFTER} after,
        for context.
      </p>
      <div className="call-examples__grid">
        {examples.map(({ label, call }) => {
          const { rows, leadEndIndex } = callExampleRows(method, call, ROWS_BEFORE, ROWS_AFTER)
          return (
            <div key={label} className="call-example">
              <h4 className="call-example__label">{label}</h4>
              {view === 'numbers' ? (
                <div className="rows-grid" style={{ fontSize: `${exampleFont}px` }}>
                  {rows.map((row, i) => {
                    const chars = row.toArray()
                    return (
                      <div key={i} className={i === leadEndIndex ? 'row lead-end' : 'row'}>
                        {chars.map((bell, pos) => (
                          <span
                            key={pos}
                            className={bell === 0 ? 'b-treble' : bell === workingBell ? 'b-work' : undefined}
                          >
                            {bellToChar(bell)}
                          </span>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <Blueline
                  rows={rows}
                  stage={stage}
                  workingBell={workingBell}
                  rowHeight={Math.max(rowHeight, 12)}
                  otherBells
                  markRowIndex={leadEndIndex}
                  hideLegend
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
