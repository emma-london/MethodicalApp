import { lazy, Suspense, useState } from 'react'
import { STAGE_NAMES } from '../data/methods'
import type { MethodDef } from '../data/methods'
import { useMethodCatalog } from '../state/MethodCatalog'
import { useSpliceSets, removeSpliceSet } from '../state/spliceSetStore'
import Dropdown from './Dropdown'
import { usePersistentState } from '../hooks/usePersistentState'

// Lazy so the CCCBR loader (and its parser) split into their own chunk, fetched
// only when a power user opens the browser — off the launch path.
const MethodBrowser = lazy(() => import('./MethodBrowser'))
const SpliceSetBuilder = lazy(() => import('./SpliceSetBuilder'))

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
  // The picker shows the standard set plus any methods the ringer has used
  // before (tier 1 + 2); the full CCCBR library lives behind the browser.
  const { pickerMethods, stages, hasLoaded, remember } = useMethodCatalog()
  // Built-in + user-created spliced sets.
  const { all: spliceSets, builtIn: builtInSpliceSets } = useSpliceSets()

  // Open on the stage of the currently-selected method so it's already narrowed
  // and the current choice is visible.
  const currentStage = pickerMethods.find((m) => m.name === methodName)?.stage
  const [stageFilter, setStageFilter] = usePersistentState<StageFilter>(
    'methodical.picker.stage',
    currentStage ?? 'all',
    (r) => (r === 'all' ? 'all' : Number.isInteger(Number(r)) ? Number(r) : undefined),
  )

  // The method browser overlay (Add / Search the full CCCBR library).
  const [browser, setBrowser] = useState<null | 'add' | 'search'>(null)
  // The spliced-group builder overlay.
  const [buildingSplice, setBuildingSplice] = useState(false)

  const visible =
    stageFilter === 'all'
      ? pickerMethods
      : pickerMethods.filter((m) => m.stage === stageFilter)

  // Method dropdown order: group by family/classification (Bob, Surprise, …)
  // alphabetically, then by name within each family.
  const ordered = [...visible].sort(
    (a, b) => a.classification.localeCompare(b.classification) || a.name.localeCompare(b.name),
  )

  // When a single stage is chosen, the stage word (e.g. "Triples") is redundant
  // with the Stage dropdown, so drop it: "Grandsire Triples" -> "Grandsire".
  // In "All stages" we keep it, since it's the only thing distinguishing e.g.
  // Cambridge Surprise Minor / Major / Royal. The value stays the full name.
  const methodLabel = (m: MethodDef) => {
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
      next === 'all' || pickerMethods.some((m) => m.name === methodName && m.stage === next)
    if (!stillVisible) {
      const first = pickerMethods.find((m) => m.stage === next)
      if (first) onMethodChange(first.name)
    }
  }

  // Selecting a method in the browser makes it active and promotes it to the
  // "used" tier so it appears inline in the picker next time.
  const handleBrowserPick = (m: MethodDef) => {
    remember(m)
    onMethodChange(m.name)
    setStageFilter(m.stage)
    setBrowser(null)
  }

  // Bottom-of-list actions on the method dropdown: load a CCCBR file, and (once
  // something is loaded) search what's been loaded.
  const methodActions = [
    { label: '+ Add methods from CCCBR…', onSelect: () => setBrowser('add') },
    ...(hasLoaded
      ? [{ label: '🔍 Search loaded methods…', onSelect: () => setBrowser('search') }]
      : []),
  ]

  const splicedEnabled = !!onSpliceModeChange && spliceSets.length > 0

  const selectedSpliceName = spliceSetName ?? spliceSets[0]?.name
  const selectedSpliceSet = spliceSets.find((s) => s.name === selectedSpliceName)

  const deleteSelectedSet = () => {
    if (!selectedSpliceSet?.custom) return
    removeSpliceSet(selectedSpliceSet.name)
    // Fall back to the first built-in set now that the custom one is gone.
    onSpliceSetChange?.(builtInSpliceSets[0]?.name ?? '')
  }

  // Bottom-of-list actions on the spliced-set dropdown: create a group, and
  // (when a custom set is selected) delete it.
  const spliceActions = [
    { label: '+ New spliced group…', onSelect: () => setBuildingSplice(true) },
    ...(selectedSpliceSet?.custom
      ? [{ label: `🗑 Delete “${selectedSpliceSet.name}”`, onSelect: deleteSelectedSet }]
      : []),
  ]

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
            value={selectedSpliceName ?? ''}
            onChange={(v) => onSpliceSetChange?.(v)}
            options={spliceSets.map((s) => ({
              value: s.name,
              label: s.custom ? `${s.name} ★` : s.name,
            }))}
            actions={spliceActions}
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
              actions={methodActions}
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
                ...stages.map((s) => ({ value: String(s), label: String(STAGE_NAMES[s] ?? s) })),
              ]}
            />
          </div>
        </>
      )}

      {browser && (
        <Suspense fallback={null}>
          <MethodBrowser
            initialMode={browser}
            initialStage={typeof stageFilter === 'number' ? stageFilter : currentStage}
            onPick={handleBrowserPick}
            onClose={() => setBrowser(null)}
          />
        </Suspense>
      )}

      {buildingSplice && (
        <Suspense fallback={null}>
          <SpliceSetBuilder
            initialStage={selectedSpliceSet?.stage ?? (typeof stageFilter === 'number' ? stageFilter : currentStage)}
            onCreated={(name) => onSpliceSetChange?.(name)}
            onClose={() => setBuildingSplice(false)}
          />
        </Suspense>
      )}
    </>
  )
}
