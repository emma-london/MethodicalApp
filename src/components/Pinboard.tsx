import { useEffect, useMemo, useRef, useState } from 'react'
import { bellToChar } from 'ringing-lib-ts'
import type { MethodDef } from '../data/methods'
import { buildMethod, plainCourseRows, bellPath } from '../logic/course'
import MethodPicker from './MethodPicker'

interface Props {
  method: MethodDef
  methodName: string
  onMethodChange: (name: string) => void
}

// A distinct, dark-background-friendly colour per bell (0-based). Wraps for
// stages above 12, which is plenty for a spike.
const BELL_COLOURS = [
  '#d15563', // 1 treble — red
  '#53c0f0', // 2 — blue
  '#4caf82', // 3 — green
  '#f0a853', // 4 — orange
  '#b388ff', // 5 — purple
  '#ffd54f', // 6 — yellow
  '#26c6da', // 7 — cyan
  '#f06292', // 8 — pink
  '#a1e44d', // 9 — lime
  '#ff8a80', // 10 — salmon
  '#80cbc4', // 11 — teal
  '#ce93d8', // 12 — light purple
]
const bellColour = (b: number) => BELL_COLOURS[b % BELL_COLOURS.length]

const PAD = 14
const MIN_DX = 13 // lower bound so high stages (e.g. Maximus) compress to fit
const MAX_DX = 40
const GRID_PIN_R = 2.5 // the faint background pins
const DOT_R = 5 // a placed pin on a drawn line

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// Split a bell's per-row places (place or null) into runs of consecutive
// drawn rows, so a lifted-then-restarted stroke renders as separate polylines.
function segments(places: (number | null)[]): { row: number; place: number }[][] {
  const out: { row: number; place: number }[][] = []
  let cur: { row: number; place: number }[] = []
  places.forEach((p, row) => {
    if (p == null) {
      if (cur.length) out.push(cur)
      cur = []
    } else {
      cur.push({ row, place: p })
    }
  })
  if (cur.length) out.push(cur)
  return out
}

export default function Pinboard({ method, methodName, onMethodChange }: Props) {
  const stage = method.stage
  // The bell most recently drawn (0-based), or null. There's no manual bell
  // selection — the bell is inferred from which pin you grab. This just drives
  // the "Clear" button, the meta line, and a subtle emphasis on that line.
  const [activeBell, setActiveBell] = useState<number | null>(null)
  const [rowGap, setRowGap] = useState(22) // vertical px per row
  const [showAnswer, setShowAnswer] = useState(false)
  // Status indicator above the grid: green when idle, pulses red on a blocked move.
  const [status, setStatus] = useState<'ok' | 'blocked'>('ok')
  // A transient red pulse on the pin the user was refused.
  const [flash, setFlash] = useState<{ row: number; place: number; key: number } | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const statusTimer = useRef<number | null>(null)
  const flashTimer = useRef<number | null>(null)
  // Live stroke state, held in a ref so pointer moves don't need re-renders to
  // read the last point.
  const stroke = useRef<{ active: boolean; bell: number; lastRow: number; lastPlace: number }>({
    active: false,
    bell: 0,
    lastRow: 0,
    lastPlace: 0,
  })

  // One lead of the method: its rows and, from them, each bell's true line.
  const { leadRows, trueLines, error } = useMemo(() => {
    try {
      const m = buildMethod(method)
      const all = plainCourseRows(m)
      const lead = all.slice(0, m.leadLength + 1) // both lead heads, so lines close
      const lines = Array.from({ length: stage }, (_, b) => bellPath(lead, b))
      return { leadRows: lead, trueLines: lines, error: null as string | null }
    } catch (e) {
      return { leadRows: [], trueLines: [], error: (e as Error).message }
    }
  }, [method, stage])

  const numRows = leadRows.length

  // What the user has drawn: for each bell, a place per row (or null = blank).
  const [drawn, setDrawn] = useState<(number | null)[][]>([])
  // Reset the board whenever the method (and therefore the grid) changes.
  useEffect(() => {
    setDrawn(Array.from({ length: stage }, () => Array<number | null>(numRows).fill(null)))
    setActiveBell(null)
  }, [stage, numRows, methodName])

  // Measure the container so the grid spreads across the available width.
  const [availW, setAvailW] = useState(0)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setAvailW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const dx =
    availW > 0
      ? clamp((availW - PAD * 2) / Math.max(1, stage - 1), MIN_DX, MAX_DX)
      : 32
  const OX = PAD
  const width = (stage - 1) * dx + PAD * 2
  const height = (numRows - 1) * rowGap + PAD * 2

  const xOf = (place: number) => place * dx + OX
  const yOf = (row: number) => row * rowGap + PAD
  const rowFromY = (y: number) => clamp(Math.round((y - PAD) / rowGap), 0, numRows - 1)
  const placeFromX = (x: number) => clamp(Math.round((x - OX) / dx), 0, stage - 1)

  // Refuse a move: pulse the status indicator red and flash the offending pin.
  const reject = (row: number, pl: number) => {
    setStatus('blocked')
    if (statusTimer.current) window.clearTimeout(statusTimer.current)
    statusTimer.current = window.setTimeout(() => setStatus('ok'), 700)
    setFlash({ row, place: pl, key: Date.now() })
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 260)
  }

  // Try to place `bell` at (row, place). Only commits if it matches that bell's
  // true line; otherwise it's refused (nothing drawn) and flashed. Returns true
  // when accepted.
  const tryPlace = (bell: number, row: number, pl: number): boolean => {
    if (trueLines[bell]?.[row] !== pl) {
      reject(row, pl)
      return false
    }
    setDrawn((prev) => {
      const next = prev.map((a) => a.slice())
      if (!next[bell]) return prev
      next[bell][row] = pl
      return next
    })
    return true
  }

  // The frontier of a bell's line: the deepest row drawn so far, counting only
  // the unbroken run from the top. -1 means the bell hasn't been started, so its
  // resume point is the top pin (row 0).
  const frontierRow = (bell: number): number => {
    const d = drawn[bell]
    if (!d) return -1
    let r = 0
    while (r < numRows && d[r] != null) r++
    return r - 1
  }

  const localPoint = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (error || numRows === 0) return
    const { x, y } = localPoint(e)
    const row = rowFromY(y)
    const pl = placeFromX(x)
    // Every pin belongs to exactly one bell (each row is a permutation). The bell
    // you grab is that owner — no manual selection.
    const bell = leadRows[row].toArray()[pl]
    // You can only pick a bell up at its frontier: the lowest pin it's been drawn
    // to, or the top pin if it hasn't been started. Grabbing anywhere else is
    // refused, so you always continue from where you left off.
    const f = frontierRow(bell)
    const resumeRow = f < 0 ? 0 : f
    const resumePlace = trueLines[bell][resumeRow]
    if (row !== resumeRow || pl !== resumePlace) {
      reject(row, pl)
      return
    }
    // Starting a fresh bell: lay its top pin down now.
    if (f < 0) tryPlace(bell, 0, resumePlace)
    svgRef.current?.setPointerCapture(e.pointerId)
    stroke.current = { active: true, bell, lastRow: resumeRow, lastPlace: resumePlace }
    setActiveBell(bell)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!stroke.current.active) return
    e.preventDefault()
    const { x, y } = localPoint(e)
    const targetRow = rowFromY(y)
    const targetPlace = placeFromX(x)
    // Walk one row at a time toward the pointer. Each step is snapped to a legal
    // move (stay or shift one place); it commits only if it's the correct place,
    // otherwise the step is refused and the stroke stalls here until the pointer
    // heads for the right pin.
    const { bell } = stroke.current
    let { lastRow, lastPlace } = stroke.current
    let guard = 0
    while (lastRow !== targetRow && guard++ < 400) {
      const step = targetRow > lastRow ? 1 : -1
      const nextRow = lastRow + step
      const np = clamp(clamp(targetPlace, lastPlace - 1, lastPlace + 1), 0, stage - 1)
      if (!tryPlace(bell, nextRow, np)) break
      lastRow = nextRow
      lastPlace = np
    }
    stroke.current.lastRow = lastRow
    stroke.current.lastPlace = lastPlace
  }

  const endStroke = () => {
    stroke.current.active = false
  }

  const clearBell = (b: number) => {
    setDrawn((prev) => prev.map((a, i) => (i === b ? Array<number | null>(numRows).fill(null) : a)))
    setActiveBell((cur) => (cur === b ? null : cur))
  }
  const clearAll = () => {
    setDrawn(Array.from({ length: stage }, () => Array<number | null>(numRows).fill(null)))
    setActiveBell(null)
  }

  if (error) return <p className="feedback err">Could not build method: {error}</p>

  return (
    <div>
      <div className="controls">
        <MethodPicker methodName={methodName} onMethodChange={onMethodChange} />
        <div className="field field--wide-only">
          <label htmlFor="pin-zoom">Vertical zoom</label>
          <input
            id="pin-zoom"
            className="zoom-range"
            type="range"
            min={12}
            max={44}
            step={1}
            value={rowGap}
            onChange={(e) => setRowGap(Number(e.target.value))}
            aria-label="Grid vertical zoom"
          />
        </div>
      </div>

      <div className="pin-actions">
        <label className="legend-toggle">
          <input type="checkbox" checked={showAnswer} onChange={(e) => setShowAnswer(e.target.checked)} />
          Show answer
        </label>
        <button className="pin-btn" onClick={() => activeBell != null && clearBell(activeBell)} disabled={activeBell == null}>
          Clear {activeBell != null ? bellToChar(activeBell) : 'bell'}
        </button>
        <button className="pin-btn" onClick={clearAll}>Clear all</button>
      </div>

      <div className={`pin-status pin-status--${status}`} role="status" aria-live="polite">
        <span className="pin-status__dot" />
        {status === 'ok'
          ? 'Drag a bell down from the top — or from where you left off'
          : 'That move isn’t allowed'}
      </div>

      <div className="pin-surface" ref={wrapRef}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="pin-svg"
          role="img"
          aria-label={`Pinboard: one lead of ${method.name}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        >
          {/* faint place columns */}
          {Array.from({ length: stage }, (_, p) => (
            <line key={`col-${p}`} x1={xOf(p)} y1={yOf(0)} x2={xOf(p)} y2={yOf(numRows - 1)} stroke="var(--surface2)" strokeWidth={1} />
          ))}
          {/* the pins */}
          {Array.from({ length: numRows }, (_, row) =>
            Array.from({ length: stage }, (_, p) => (
              <circle key={`pin-${row}-${p}`} cx={xOf(p)} cy={yOf(row)} r={GRID_PIN_R} fill="var(--text-muted)" opacity={0.5} />
            )),
          )}

          {/* the true lines, faint, when "Show answer" is on */}
          {showAnswer &&
            trueLines.map((line, b) => (
              <polyline
                key={`ans-${b}`}
                points={line.map((p, row) => `${xOf(p)},${yOf(row)}`).join(' ')}
                fill="none"
                stroke={bellColour(b)}
                strokeWidth={2}
                strokeOpacity={0.25}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

          {/* the user's drawn lines */}
          {drawn.map((places, b) =>
            segments(places).map((seg, si) => (
              <polyline
                key={`line-${b}-${si}`}
                points={seg.map((s) => `${xOf(s.place)},${yOf(s.row)}`).join(' ')}
                fill="none"
                stroke={bellColour(b)}
                strokeWidth={b === activeBell ? 3 : 2.25}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )),
          )}

          {/* placed dots (all correct by construction) */}
          {drawn.map((places, b) =>
            places.map((p, row) =>
              p == null ? null : (
                <circle key={`dot-${b}-${row}`} cx={xOf(p)} cy={yOf(row)} r={DOT_R} fill={bellColour(b)} />
              ),
            ),
          )}

          {/* a quick red pulse on a refused pin */}
          {flash && (
            <circle
              key={flash.key}
              className="pin-flash"
              cx={xOf(flash.place)}
              cy={yOf(flash.row)}
              r={DOT_R + 3}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={3}
            />
          )}
        </svg>
      </div>

      <p className="meta meta--bottom">
        <strong>{method.name}</strong> · {method.classification} · one lead of {numRows - 1} changes{activeBell != null ? ` · drawing the ${bellToChar(activeBell)}` : ''}
      </p>
    </div>
  )
}
