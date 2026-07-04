import { useMemo } from 'react'
import type { Row } from 'ringing-lib-ts'
import { bellToChar } from 'ringing-lib-ts'
import { bellPath } from '../logic/course'

interface Props {
  rows: Row[]
  stage: number
  workingBell: number // 0-based
}

const DX = 22
const DY = 13
const PAD = 18

export default function Blueline({ rows, stage, workingBell }: Props) {
  const { treble, work, width, height } = useMemo(() => {
    const treble = bellPath(rows, 0)
    const work = bellPath(rows, workingBell)
    return {
      treble,
      work,
      width: (stage - 1) * DX + PAD * 2,
      height: (rows.length - 1) * DY + PAD * 2,
    }
  }, [rows, stage, workingBell])

  const toPoints = (path: number[]) =>
    path.map((place, i) => `${place * DX + PAD},${i * DY + PAD}`).join(' ')

  return (
    <div className="blueline-wrap">
      <div className="legend">
        <span><i className="swatch" style={{ background: 'var(--treble)' }} /> Treble (1)</span>
        <span><i className="swatch" style={{ background: 'var(--workbell)' }} /> Working bell ({bellToChar(workingBell)})</span>
      </div>
      <svg width={width} height={height} role="img" aria-label="Blue line">
        {/* faint place columns */}
        {Array.from({ length: stage }, (_, p) => (
          <line
            key={p}
            x1={p * DX + PAD}
            y1={PAD}
            x2={p * DX + PAD}
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
        <circle cx={treble[0] * DX + PAD} cy={PAD} r={4} fill="var(--treble)" />
        <circle cx={work[0] * DX + PAD} cy={PAD} r={4} fill="var(--workbell)" />
      </svg>
    </div>
  )
}
