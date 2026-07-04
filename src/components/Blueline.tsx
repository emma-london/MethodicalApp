import { useEffect, useMemo, useRef, useState } from 'react'
import type { Row } from 'ringing-lib-ts'
import { bellToChar } from 'ringing-lib-ts'
import { bellPath } from '../logic/course'

interface Props {
  rows: Row[]
  stage: number
  workingBell: number // 0-based
  rowHeight?: number // vertical spacing per row (px); lower = more squashed
}

const PAD = 18
const MIN_DX = 16
const MAX_DX = 60

export default function Blueline({ rows, stage, workingBell, rowHeight = 6 }: Props) {
  const dy = rowHeight
  const wrapRef = useRef<HTMLDivElement>(null)
  const [availW, setAvailW] = useState(0)

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
      ? Math.max(MIN_DX, Math.min(MAX_DX, (availW - PAD * 2 - 24) / Math.max(1, stage - 1)))
      : 26

  const { treble, work, width, height } = useMemo(() => {
    const treble = bellPath(rows, 0)
    const work = bellPath(rows, workingBell)
    return {
      treble,
      work,
      width: (stage - 1) * dx + PAD * 2,
      height: (rows.length - 1) * dy + PAD * 2,
    }
  }, [rows, stage, workingBell, dx, dy])

  const toPoints = (path: number[]) =>
    path.map((place, i) => `${place * dx + PAD},${i * dy + PAD}`).join(' ')

  return (
    <div className="blueline-wrap" ref={wrapRef}>
      <div className="legend">
        <span><i className="swatch" style={{ background: 'var(--treble)' }} /> Treble (1)</span>
        <span><i className="swatch" style={{ background: 'var(--workbell)' }} /> Working bell ({bellToChar(workingBell)})</span>
      </div>
      <svg width={width} height={height} role="img" aria-label="Blue line">
        {/* faint place columns */}
        {Array.from({ length: stage }, (_, p) => (
          <line
            key={p}
            x1={p * dx + PAD}
            y1={PAD}
            x2={p * dx + PAD}
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
        <circle cx={treble[0] * dx + PAD} cy={PAD} r={4} fill="var(--treble)" />
        <circle cx={work[0] * dx + PAD} cy={PAD} r={4} fill="var(--workbell)" />
      </svg>
    </div>
  )
}
