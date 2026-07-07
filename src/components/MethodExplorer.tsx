import { useEffect, useMemo, useState } from 'react'
import { bellToChar } from 'ringing-lib-ts'
import type { MethodDef } from '../data/methods'
import { buildMethod, plainCourseRows, placeBellName } from '../logic/course'
import MethodPicker from './MethodPicker'
import Blueline from './Blueline'

interface Props {
  method: MethodDef
  methodName: string
  onMethodChange: (name: string) => void
}

type View = 'numbers' | 'blueline'

// Remember the reader's text-size and vertical-zoom choices across sessions.
const ROW_HEIGHT_KEY = 'methodical.explorer.rowHeight'
const TEXT_SIZE_KEY = 'methodical.explorer.textSize'

function loadNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) {
      const n = Number(raw)
      if (Number.isFinite(n)) return n
    }
  } catch {
    // localStorage may be unavailable (e.g. private mode); fall back silently.
  }
  return fallback
}

export default function MethodExplorer({ method, methodName, onMethodChange }: Props) {
  const [view, setView] = useState<View>('numbers')
  const [workingBell, setWorkingBell] = useState(1) // 0-based; default the "2"
  const [rowHeight, setRowHeight] = useState(() => loadNumber(ROW_HEIGHT_KEY, 6)) // blue line vertical spacing (px); lower = squashed
  const [textSize, setTextSize] = useState(() => loadNumber(TEXT_SIZE_KEY, 18)) // numbers view font size (px)

  // Persist the reader's preferences whenever they change.
  useEffect(() => {
    try {
      localStorage.setItem(ROW_HEIGHT_KEY, String(rowHeight))
    } catch {
      // ignore write failures (private mode, quota, etc.)
    }
  }, [rowHeight])
  useEffect(() => {
    try {
      localStorage.setItem(TEXT_SIZE_KEY, String(textSize))
    } catch {
      // ignore write failures (private mode, quota, etc.)
    }
  }, [textSize])

  const { rows, leadLength, error } = useMemo(() => {
    try {
      const m = buildMethod(method)
      return { rows: plainCourseRows(m), leadLength: m.leadLength, error: null as string | null }
    } catch (e) {
      return { rows: [], leadLength: 0, error: (e as Error).message }
    }
  }, [method])

  // Keep the selected working bell in range when the stage changes.
  const wb = Math.min(workingBell, method.stage - 1)

  if (error) return <p className="feedback err">Could not build method: {error}</p>

  return (
    <div>
      <div className="controls">
        <MethodPicker methodName={methodName} onMethodChange={onMethodChange} />
        <div className="field">
          <label htmlFor="wb-select">Working bell</label>
          <select
            id="wb-select"
            value={wb}
            onChange={(e) => setWorkingBell(Number(e.target.value))}
          >
            {Array.from({ length: method.stage - 1 }, (_, i) => i + 1).map((b) => (
              <option key={b} value={b}>{bellToChar(b)}</option>
            ))}
          </select>
        </div>
        <div className="seg" role="tablist" aria-label="View">
          <button className={view === 'numbers' ? 'active' : ''} onClick={() => setView('numbers')}>Numbers</button>
          <button className={view === 'blueline' ? 'active' : ''} onClick={() => setView('blueline')}>Blue line</button>
        </div>
        {view === 'blueline' ? (
          <div className="field">
            <label htmlFor="zoom">Vertical zoom</label>
            <input
              id="zoom"
              className="zoom-range"
              type="range"
              min={4}
              max={16}
              step={1}
              value={rowHeight}
              onChange={(e) => setRowHeight(Number(e.target.value))}
              aria-label="Blue line vertical zoom"
            />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="textsize">Text size</label>
            <input
              id="textsize"
              className="zoom-range"
              type="range"
              min={14}
              max={40}
              step={2}
              value={textSize}
              onChange={(e) => setTextSize(Number(e.target.value))}
              aria-label="Numbers text size"
            />
          </div>
        )}
      </div>

      <p className="meta">
        <strong>{method.name}</strong> · {method.classification} · {method.notation} · plain course of {rows.length - 1} rows
      </p>

      {view === 'numbers' ? (
        <div className="rows-grid" style={{ fontSize: `${textSize}px` }}>
          {rows.map((row, i) => {
            const isLeadHead = i > 0 && i % leadLength === 0
            const chars = row.toArray()
            // Place bell for the lead beginning at this lead head (skip the
            // final rounds row, which just repeats the start).
            const showPlaceBell =
              leadLength > 0 && i % leadLength === 0 && i !== rows.length - 1
            return (
              <div key={i} className={isLeadHead ? 'row lead-end' : 'row'}>
                {chars.map((bell, pos) => (
                  <span
                    key={pos}
                    className={bell === 0 ? 'b-treble' : bell === wb ? 'b-work' : undefined}
                  >
                    {bellToChar(bell)}
                  </span>
                ))}
                {showPlaceBell && (
                  <span
                    className="pb-mark"
                    title={`${placeBellName(chars.indexOf(wb) + 1)} place bell`}
                  >
                    {placeBellName(chars.indexOf(wb) + 1)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <Blueline
          rows={rows}
          stage={method.stage}
          workingBell={wb}
          rowHeight={rowHeight}
          leadLength={leadLength}
        />
      )}
    </div>
  )
}
