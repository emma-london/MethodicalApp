import { useEffect, useMemo, useRef, useState } from 'react'
import type { Row } from 'ringing-lib-ts'
import { bellToChar } from 'ringing-lib-ts'
import { bellPath } from '../logic/course'

interface Props {
  rows: Row[]
  stage: number
  workingBell: number // 0-based
  rowHeight?: number // vertical spacing per row (px); lower = more squashed
  leadLength?: number // rows per lead; enables place-bell labels at lead heads
  otherBells?: boolean // draw every other bell as a faint grey line behind
  markRowIndex?: number // draw a dashed horizontal marker at this row index
  hideLegend?: boolean // hide the legend (for compact example views)
}

const PAD = 18
const MIN_DX = 16
const MAX_DX = 60
// Right-hand gutter reserved for the place-bell circles, so they sit clear of
// the line (to the right of the highest place) rather than overlapping it.
const PB_GUTTER = 34
const PB_R = 10 // place-bell circle radius
const PB_FONT = 14 // place-bell number size (≈ the numbers-view row size)

export default function Blueline({
  rows,
  stage,
  workingBell,
  rowHeight = 6,
  leadLength = 0,
  otherBells = false,
  markRowIndex,
  hideLegend = false,
}: Props) {
  const dy = rowHeight
  const wrapRef = useRef<HTMLDivElement>(null)
  const [availW, setAvailW] = useState(0)

  // x origin of 1st place. Place-bell circles live in a gutter on the right.
  const OX = PAD

  // Measure the container so the blue line spreads across the available width.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setAvailW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Column spacing: fill the width, but clamp so it never gets silly.
  const dx =
    availW > 0
      ? Math.max(MIN_DX, Math.min(MAX_DX, (availW - PAD * 2 - PB_GUTTER) / Math.max(1, stage - 1)))
      : 26

  const { treble, work, others, width, height, placeBells } = useMemo(() => {
    const treble = bellPath(rows, 0)
    const work = bellPath(rows, workingBell)
    // Every other bell (not treble, not the working bell), drawn faint grey.
    const others: number[][] = []
    if (otherBells) {
      for (let b = 0; b < stage; b++) {
        if (b === 0 || b === workingBell) continue
        others.push(bellPath(rows, b))
      }
    }
    // Place bell at each lead head (skip the final rounds row).
    const placeBells: { i: number; place: number }[] = []
    if (leadLength > 0) {
      for (let i = 0; i < rows.length; i += leadLength) {
        if (i === rows.length - 1) continue
        placeBells.push({ i, place: work[i] + 1 })
      }
    }
    return {
      treble,
      work,
      others,
      placeBells,
      width: (stage - 1) * dx + PAD * 2 + PB_GUTTER,
      height: (rows.length - 1) * dy + PAD * 2,
    }
  }, [rows, stage, workingBell, dx, dy, leadLength, OX, otherBells])

  const toPoints = (path: number[]) =>
    path.map((place, i) => `${place * dx + OX},${i * dy + PAD}`).join(' ')

  return (
    <div className="blueline-wrap" ref={wrapRef}>
      {!hideLegend && (
        <div className="legend">
          <span><i className="swatch" style={{ background: 'var(--treble)' }} /> Treble (1)</span>
          <span><i className="swatch" style={{ background: 'var(--workbell)' }} /> Working bell ({bellToChar(workingBell)})</span>
          {leadLength > 0 && <span className="legend-note">Labels = place bell at each lead end</span>}
        </div>
      )}
      <svg width={width} height={height} role="img" aria-label="Blue line">
        {/* faint place columns */}
        {Array.from({ length: stage }, (_, p) => (
          <line
            key={p}
            x1={p * dx + OX}
            y1={PAD}
            x2={p * dx + OX}
            y2={height - PAD}
            stroke="var(--surface2)"
            strokeWidth={1}
          />
        ))}
        {/* every other bell, faint grey, behind the treble & working lines */}
        {others.map((path, idx) => (
          <polyline
            key={`other-${idx}`}
            points={toPoints(path)}
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth={1}
            strokeOpacity={0.45}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {/* dashed marker at the lead end (where the call takes effect) */}
        {markRowIndex != null && (
          <line
            x1={PAD}
            y1={markRowIndex * dy + PAD}
            x2={width - PAD}
            y2={markRowIndex * dy + PAD}
            stroke="var(--text-muted)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}
        <polyline
          points={toPoints(treble)}
          fill="none"
          stroke="var(--treble)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={toPoints(work)}
          fill="none"
          stroke="var(--workbell)"
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* start markers */}
        <circle cx={treble[0] * dx + OX} cy={PAD} r={4} fill="var(--treble)" />
        <circle cx={work[0] * dx + OX} cy={PAD} r={4} fill="var(--workbell)" />
        {/* place bells: a small anchor dot on the working line at each lead head,
            with the place-bell number in a circle out in the right gutter, level
            with that row. */}
        {placeBells.map(({ i, place }) => {
          const cy = i * dy + PAD
          const cx = (stage - 1) * dx + OX + PB_GUTTER / 2
          return (
            <g key={i}>
              <circle cx={work[i] * dx + OX} cy={cy} r={3} fill="var(--workbell)" />
              <circle cx={cx} cy={cy} r={PB_R} fill="var(--surface)" stroke="var(--workbell)" strokeWidth={2} />
              <text
                x={cx}
                y={cy}
                fontSize={PB_FONT}
                fontWeight={700}
                fill="var(--workbell)"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {bellToChar(place - 1)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
