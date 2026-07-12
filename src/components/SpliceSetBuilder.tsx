import { useEffect, useMemo, useState } from 'react'
import { STAGE_NAMES } from '../data/methods'
import type { MethodDef } from '../data/methods'
import { useMethodCatalog } from '../state/MethodCatalog'
import { addSpliceSet, spliceSetNameTaken } from '../state/spliceSetStore'
import Dropdown from './Dropdown'

interface Props {
  /** Stage to open on, if it has enough methods; otherwise the first that does. */
  initialStage?: number
  /** Called with the new set's name once saved, so the picker can select it. */
  onCreated: (name: string) => void
  onClose: () => void
}

const stageLabel = (s: number) => STAGE_NAMES[s] ?? String(s)

// Splicing needs at least two methods to switch between.
const MIN_METHODS = 2

export default function SpliceSetBuilder({ initialStage, onCreated, onClose }: Props) {
  const { pickerMethods, stages } = useMethodCatalog()

  // Stages that actually have enough methods to build a spliced set from.
  const usableStages = useMemo(
    () => stages.filter((s) => pickerMethods.filter((m) => m.stage === s).length >= MIN_METHODS),
    [stages, pickerMethods],
  )

  const [stage, setStage] = useState<number>(() => {
    if (initialStage && usableStages.includes(initialStage)) return initialStage
    return usableStages.includes(8) ? 8 : usableStages[0] ?? stages[0]
  })
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Methods available at the chosen stage, grouped by family then name (as in
  // the method picker). This list already includes any downloaded/used methods.
  const methodsForStage = useMemo(
    () =>
      pickerMethods
        .filter((m) => m.stage === stage)
        .sort(
          (a, b) =>
            a.classification.localeCompare(b.classification) || a.name.localeCompare(b.name),
        ),
    [pickerMethods, stage],
  )

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const changeStage = (s: number) => {
    setStage(s)
    // A set is single-stage: drop any picks that don't belong to the new stage.
    setSelected((prev) => {
      const keep = new Set(pickerMethods.filter((m) => m.stage === s).map((m) => m.name))
      return new Set([...prev].filter((n) => keep.has(n)))
    })
  }

  const toggle = (m: MethodDef) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(m.name)) next.delete(m.name)
      else next.add(m.name)
      return next
    })
  }

  const trimmed = name.trim()
  const nameTaken = trimmed !== '' && spliceSetNameTaken(trimmed)
  const chosen = methodsForStage.filter((m) => selected.has(m.name))
  const canSave = trimmed !== '' && !nameTaken && chosen.length >= MIN_METHODS

  const save = () => {
    if (!canSave) return
    addSpliceSet({ name: trimmed, stage, methods: chosen.map((m) => m.name) })
    onCreated(trimmed)
    onClose()
  }

  return (
    <div className="browser-overlay" onPointerDown={onClose}>
      <div
        className="browser-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Create a spliced group"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="browser-head">
          <h2>New spliced group</h2>
          <button className="browser-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="browser-hint">
          Name your group, pick a stage, then tick the methods to splice. All
          methods you have — including any downloaded from CCCBR — are listed.
        </p>

        <div className="splice-build-row">
          <div className="field splice-build-name">
            <label htmlFor="sb-name">Group name</label>
            <input
              id="sb-name"
              className="browser-input"
              type="text"
              placeholder="e.g. My Surprise Major 6"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="sb-stage">Stage</label>
            <Dropdown
              id="sb-stage"
              value={String(stage)}
              onChange={(v) => changeStage(Number(v))}
              tallMenu
              options={usableStages.map((s) => ({ value: String(s), label: stageLabel(s) }))}
            />
          </div>
        </div>

        {nameTaken && <p className="splice-build-warn">A group called “{trimmed}” already exists.</p>}

        <div className="splice-build-list-head">
          <span>Methods ({stageLabel(stage)})</span>
          <span className={chosen.length >= MIN_METHODS ? 'splice-count ok' : 'splice-count'}>
            {chosen.length} selected
          </span>
        </div>

        <ul className="splice-methods">
          {methodsForStage.map((m) => {
            const on = selected.has(m.name)
            return (
              <li key={m.name}>
                <label className={on ? 'splice-method is-on' : 'splice-method'}>
                  <input type="checkbox" checked={on} onChange={() => toggle(m)} />
                  <span className="splice-method-name">{m.name}</span>
                  <span className="splice-method-meta">{m.classification}</span>
                </label>
              </li>
            )
          })}
          {methodsForStage.length === 0 && (
            <li className="browser-empty">No methods at this stage yet.</li>
          )}
        </ul>

        <div className="splice-build-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--accent" disabled={!canSave} onClick={save}>
            Create group
          </button>
        </div>
        {trimmed !== '' && !nameTaken && chosen.length < MIN_METHODS && (
          <p className="browser-hint">Pick at least {MIN_METHODS} methods to splice.</p>
        )}
      </div>
    </div>
  )
}
