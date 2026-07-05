import { useState } from 'react'
import { METHODS, STAGES, STAGE_NAMES } from '../data/methods'
import { SPLICE_SETS } from '../data/spliceSets'

interface Props {
  methodName: string
  onMethodChange: (name: string) => void
  // Optional spliced controls. When `onSpliceModeChange` is supplied the picker
  // renders a Single/Spliced toggle and, in spliced mode, a preset selector in
  // place of the single-method dropdown.
  spliceMode?: boolean
  onSpliceModeChange?: (spliced: boolean) => void
  spliceSetName?: string
  onSpliceSetChange?: (name: string) => void
}

// 'all' shows every method; a number narrows the list to that stage.
type StageFilter = number | 'all'

export default function MethodPicker({
  methodName,
  onMethodChange,
  spliceMode = false,
  onSpliceModeChange,
  spliceSetName,
  onSpliceSetChange,
}: Props) {
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

  const splicedEnabled = !!onSpliceModeChange && SPLICE_SETS.length > 0

  return (
    <>
      {splicedEnabled && (
        <div className="field">
          <label>Methods</label>
          <div className="seg" role="tablist" aria-label="Method selection">
            <button
              className={!spliceMode ? 'active' : ''}
              onClick={() => onSpliceModeChange!(false)}
            >
              Single
            </button>
            <button
              className={spliceMode ? 'active' : ''}
              onClick={() => onSpliceModeChange!(true)}
            >
              Spliced
            </button>
          </div>
        </div>
      )}

      {splicedEnabled && spliceMode ? (
        <div className="field">
          <label htmlFor="splice-select">Spliced set</label>
          <select
            id="splice-select"
            value={spliceSetName ?? SPLICE_SETS[0].name}
            onChange={(e) => onSpliceSetChange?.(e.target.value)}
          >
            {SPLICE_SETS.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      ) : (
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
      )}
    </>
  )
}
