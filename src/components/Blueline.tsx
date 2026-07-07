import { useEffect, useMemo, useRef, useState } from 'react'
import type { Row } from 'ringing-lib-ts'
import { bellToChar } from 'ringing-lib-ts'
import { bellPath, placeBellName } from '../logic/course'

interface Props {
  rows: Row[]
  stage: number
  workingBell: number // 0-based
  rowHeight?: number // vertical spacing per row (px); lower = more squashed
  leadLength?: number // rows per lead; enables place-bell labels at lead heads
}

const PAD = 18
const MIN_DX = 16
const MAX_DX = 60
// Left gutter reserved for place-bell labels, so they sit clear of the line
// (to the left of 1st place) rather than overlapping it.
const LABEL_W = 40

export default function Blueline({ rows, stage, workingBell, rowHeight = 6, leadLength = 0 }: Props) {
  const dy = rowHeight
  const wrapRef = useRef<HTMLDivElement>(null)
  const [availW, setAvailW] = useState(0)

  // x origin of 1st place — the drawing is shifted right to leave the label gutter.
  const OX = PAD + LABEL_W

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
      ? Math.max(MIN_DX, Math.min(MAX_DX, (availW - PAD * 2 - LABEL_W) / Math.max(1, stage - 1)))
      : 26

  const { treble, work, width, height, placeBells } = useMemo(() => {
    const treble = bellPath(rows, 0)
    const work = bellPath(rows, workingBell)
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
      placeBells,
      width: (stage - 1) * dx + PAD * 2 + LABEL_W,
      height: (rows.length - 1) * dy + PAD * 2,
    }
  }, [rows, stage, workingBell, dx, dy, leadLength, OX])

  const toPoints = (path: number[]) =>
    path.map((place, i) => `${place * dx + OX},${i * dy + PAD}`).join(' ')

  return (
    <div className="blueline-wrap" ref={wrapRef}>
      <div className="legend">
        <span><i className="swatch" style={{ background: 'var(--treble)' }} /> Treble (1)</span>
        <span><i className="swatch" style={{ background: 'var(--workbell)' }} /> Working bell ({bellToChar(workingBell)})</span>
        {leadLength > 0 && <span className="legend-note">Labels = place bell at each lead end</span>}
      </div>
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
        <polyline
          points={toPoints(treble)}
          fill="none"
          stroke="var(--treble)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={toPoints(work)}
          fill="none"
          stroke="var(--workbell)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* start markers */}
        <circle cx={treble[0] * dx + OX} cy={PAD} r={4} fill="var(--treble)" />
        <circle cx={work[0] * dx + OX} cy={PAD} r={4} fill="var(--workbell)" />
        {/* place bells: a dot on the working line at each lead head, with the
            label aligned in the left gutter (clear of the line). */}
        {placeBells.map(({ i, place }) => (
          <g key={i}>
            <circle cx={work[i] * dx + OX} cy={i * dy + PAD} r={3.5} fill="var(--workbell)" />
            <text
              x={OX - 8}
              y={i * dy + PAD}
              fontSize={11}
              fontWeight={700}
              fill="var(--workbell)"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {placeBellName(place)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
