import { useState } from 'react'
import { METHODS, STAGES, STAGE_NAMES } from '../data/methods'
import { SPLICE_SETS } from '../data/spliceSets'
import Dropdown from './Dropdown'

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

  // Method dropdown order: group by family/classification (Bob, Surprise, …)
  // alphabetically, then by name within each family.
  const ordered = [...visible].sort(
    (a, b) => a.classification.localeCompare(b.classification) || a.name.localeCompare(b.name),
  )

  // When a single stage is chosen, the stage word (e.g. "Triples") is redundant
  // with the Stage dropdown, so drop it: "Grandsire Triples" -> "Grandsire".
  // In "All stages" we keep it, since it's the only thing distinguishing e.g.
  // Cambridge Surprise Minor / Major / Royal. The value stays the full name.
  const methodLabel = (m: (typeof METHODS)[number]) => {
    if (stageFilter === 'all') return m.name
    const word = STAGE_NAMES[m.stage]
    return word && m.name.endsWith(` ${word}`)
      ? m.name.slice(0, -(word.length + 1))
      : m.name
  }

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
          <Dropdown
            id="splice-select"
            value={spliceSetName ?? SPLICE_SETS[0].name}
            onChange={(v) => onSpliceSetChange?.(v)}
            options={SPLICE_SETS.map((s) => ({ value: s.name, label: s.name }))}
          />
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="method-select">Method</label>
            <Dropdown
              id="method-select"
              value={methodName}
              onChange={onMethodChange}
              options={ordered.map((m) => ({ value: m.name, label: methodLabel(m) }))}
            />
          </div>
          <div className="field">
            <label htmlFor="stage-select">Stage</label>
            <Dropdown
              id="stage-select"
              value={String(stageFilter)}
              onChange={handleStageChange}
              tallMenu
              options={[
                { value: 'all', label: 'All stages' },
                ...STAGES.map((s) => ({ value: String(s), label: String(STAGE_NAMES[s] ?? s) })),
              ]}
            />
          </div>
        </>
      )}
    </>
  )
}
