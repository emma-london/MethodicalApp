import { useEffect, useMemo, useState } from 'react'
import { bellToChar } from 'ringing-lib-ts'
import type { Method } from 'ringing-lib-ts'
import type { MethodDef } from '../data/methods'
import { buildMethod, plainCourseRows, placeBellName } from '../logic/course'
import MethodPicker from './MethodPicker'
import Blueline from './Blueline'
import CallExamples from './CallExamples'
import Dropdown from './Dropdown'
import { usePinchZoom } from '../hooks/usePinchZoom'

interface Props {
  method: MethodDef
  methodName: string
  onMethodChange: (name: string) => void
}

type View = 'numbers' | 'blueline'

// Remember the reader's text-size and vertical-zoom choices across sessions.
const ROW_HEIGHT_KEY = 'methodical.explorer.rowHeight'
const TEXT_SIZE_KEY = 'methodical.explorer.textSize'
// Once the reader has zoomed by gesture, we stop nagging them with the hint.
const ZOOM_HINT_KEY = 'methodical.explorer.zoomHintSeen'

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
  const [hintOn, setHintOn] = useState(() => loadNumber(ZOOM_HINT_KEY, 0) === 0) // show until first gesture

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

  const { rows, leadLength, built, error } = useMemo(() => {
    try {
      const m = buildMethod(method)
      return {
        rows: plainCourseRows(m),
        leadLength: m.leadLength,
        built: m as Method | null,
        error: null as string | null,
      }
    } catch (e) {
      return { rows: [], leadLength: 0, built: null as Method | null, error: (e as Error).message }
    }
  }, [method])

  // Pinch-to-zoom shares state with the slider: it drives the same rowHeight /
  // textSize value, but multiplicatively on the raw float, so it stays smooth
  // (we never round, we just clamp). The slider snaps; pinch does not.
  const isBlueline = view === 'blueline'
  // Fade the hint out the first time the reader actually zooms by gesture,
  // and remember that across sessions.
  const dismissHint = () => {
    if (!hintOn) return
    setHintOn(false)
    try {
      localStorage.setItem(ZOOM_HINT_KEY, '1')
    } catch {
      // ignore write failures (private mode, quota, etc.)
    }
  }
  // Bound page-wide (see usePinchZoom), so a pinch anywhere on the screen
  // drives the zoom — not just over the content box.
  usePinchZoom({
    min: isBlueline ? 2 : 8,
    max: isBlueline ? 32 : 72,
    getValue: () => (isBlueline ? rowHeight : textSize),
    setValue: (v) => {
      if (isBlueline) setRowHeight(v)
      else setTextSize(v)
      dismissHint()
    },
  })

  // Keep the selected working bell in range when the stage changes.
  const wb = Math.min(workingBell, method.stage - 1)

  if (error) return <p className="feedback err">Could not build method: {error}</p>

  return (
    <div>
      <div className="controls">
        <MethodPicker methodName={methodName} onMethodChange={onMethodChange} />
        <div className="field field--narrow">
          <label htmlFor="wb-select">Bell</label>
          <Dropdown
            id="wb-select"
            value={String(wb)}
            onChange={(v) => setWorkingBell(Number(v))}
            ariaLabel="Working bell"
            options={Array.from({ length: method.stage - 1 }, (_, i) => i + 1).map((b) => ({
              value: String(b),
              label: bellToChar(b),
            }))}
          />
        </div>
        <div className="seg" role="tablist" aria-label="View">
          <button className={view === 'numbers' ? 'active' : ''} onClick={() => setView('numbers')}>No.s</button>
          <button className={view === 'blueline' ? 'active' : ''} onClick={() => setView('blueline')}>Line</button>
        </div>
        {view === 'blueline' ? (
          <div className="field field--wide-only">
            <label htmlFor="zoom">Vertical zoom</label>
            <input
              id="zoom"
              className="zoom-range"
              type="range"
              min={2}
              max={32}
              step={0.1}
              value={rowHeight}
              onChange={(e) => setRowHeight(Number(e.target.value))}
              aria-label="Blue line vertical zoom"
            />
          </div>
        ) : (
          <div className="field field--wide-only">
            <label htmlFor="textsize">Text size</label>
            <input
              id="textsize"
              className="zoom-range"
              type="range"
              min={8}
              max={72}
              step={0.1}
              value={textSize}
              onChange={(e) => setTextSize(Number(e.target.value))}
              aria-label="Numbers text size"
            />
          </div>
        )}
      </div>

      <p className={`zoom-hint${hintOn ? '' : ' is-hidden'}`} aria-hidden={!hintOn}>
        Pinch to zoom — or Ctrl + scroll on a trackpad
      </p>
      <div className="zoom-surface">
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

      {built && (
        <CallExamples
          method={built}
          stage={method.stage}
          workingBell={wb}
          view={view}
          rowHeight={rowHeight}
          textSize={textSize}
        />
      )}

      <p className="meta meta--bottom">
        <strong>{method.name}</strong> · {method.classification} · {method.notation} · plain course of {rows.length - 1} rows
      </p>
    </div>
  )
}
