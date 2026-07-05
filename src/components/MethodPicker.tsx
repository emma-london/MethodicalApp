import { useState } from 'react'
import { METHODS, STAGES, STAGE_NAMES } from '../data/methods'

interface Props {
  methodName: string
  onMethodChange: (name: string) => void
}

// 'all' shows every method; a number narrows the list to that stage.
type StageFilter = number | 'all'

export default function MethodPicker({ methodName, onMethodChange }: Props) {
  // Open on the stage of the currently-selected method so it's already narrowed
  // and the current choice is visible.
  const currentStage = METHODS.find((m) => m.name === methodName)?.stage
  const [stageFilter, setStageFilter] = useState<StageFilter>(currentStage ?? 'all')

  const visible =
    stageFilter === 'all' ? METHODS : METHODS.filter((m) => m.stage === stageFilter)

  const handleStageChange = (value: string) => {
    const next: StageFilter = value === 'all' ? 'all' : Number(value)
    setStageFilter(next)
    // If the current method isn't in the new stage, jump to the first that is.
    const stillVisible =
      next === 'all' || METHODS.some((m) => m.name === methodName && m.stage === next)
    if (!stillVisible) {
      const first = METHODS.find((m) => m.stage === next)
      if (first) onMethodChange(first.name)
    }
  }

  return (
    <>
      <div className="field">
        <label htmlFor="stage-select">Stage</label>
        <select
          id="stage-select"
          value={stageFilter}
          onChange={(e) => handleStageChange(e.target.value)}
        >
          <option value="all">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>{STAGE_NAMES[s] ?? s}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="method-select">Method</label>
        <select
          id="method-select"
          value={methodName}
          onChange={(e) => onMethodChange(e.target.value)}
        >
          {visible.map((m) => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>
      </div>
    </>
  )
}
