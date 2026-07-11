import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CCCBR_FILE_CLASSES,
  stagesForClass,
  isAvailable,
} from 'ringing-lib-ts/cccbr-methods'
import type { CccbrFileClass } from 'ringing-lib-ts/cccbr-methods'
import { STAGE_NAMES } from '../data/methods'
import type { MethodDef } from '../data/methods'
import { useMethodCatalog } from '../state/MethodCatalog'
import Dropdown from './Dropdown'

interface Props {
  initialMode: 'add' | 'search'
  initialStage?: number
  onPick: (m: MethodDef) => void
  onClose: () => void
}

const MAX_RESULTS = 60

// The default class most power users reach for first.
const DEFAULT_CLASS: CccbrFileClass = 'Surprise'

const stageLabel = (s: number) => STAGE_NAMES[s] ?? String(s)

export default function MethodBrowser({ initialMode, initialStage, onPick, onClose }: Props) {
  const { load, loadStateFor, loaded, loadedMethods, loadError } = useMethodCatalog()

  const [fileClass, setFileClass] = useState<CccbrFileClass>(DEFAULT_CLASS)

  // Stages this class publishes; default to the picker's current stage if valid.
  const classStages = useMemo(() => stagesForClass(fileClass), [fileClass])
  const [stage, setStage] = useState<number>(() =>
    initialStage && isAvailable(DEFAULT_CLASS, initialStage)
      ? initialStage
      : stagesForClass(DEFAULT_CLASS)[0],
  )

  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Keep the selected stage valid when the class changes.
  useEffect(() => {
    if (!classStages.includes(stage)) setStage(classStages[0])
  }, [classStages, stage])

  // Focus the search box when opened straight into search mode.
  useEffect(() => {
    if (initialMode === 'search') searchRef.current?.focus()
  }, [initialMode])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const state = loadStateFor(fileClass, stage)
  const provenance = loaded.get(`${fileClass}/${stage}`)?.provenance ?? null

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = q
      ? loadedMethods.filter((m) => m.name.toLowerCase().includes(q))
      : loadedMethods
    return [...pool]
      .sort((a, b) => a.stage - b.stage || a.name.localeCompare(b.name))
      .slice(0, MAX_RESULTS)
  }, [query, loadedMethods])

  const total = loadedMethods.length

  return (
    <div className="browser-overlay" onPointerDown={onClose}>
      <div
        className="browser-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Add or search CCCBR methods"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="browser-head">
          <h2>Methods from CCCBR</h2>
          <button className="browser-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="browser-load">
          <p className="browser-hint">
            Fetch a full method set direct from the CCCBR library. Pick a class and
            stage, then search what you loaded below.
          </p>
          <div className="browser-load-row">
            <div className="field">
              <label htmlFor="br-class">Class</label>
              <Dropdown
                id="br-class"
                value={fileClass}
                onChange={(v) => setFileClass(v as CccbrFileClass)}
                options={CCCBR_FILE_CLASSES.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div className="field">
              <label htmlFor="br-stage">Stage</label>
              <Dropdown
                id="br-stage"
                value={String(stage)}
                onChange={(v) => setStage(Number(v))}
                tallMenu
                options={classStages.map((s) => ({ value: String(s), label: stageLabel(s) }))}
              />
            </div>
            <button
              className="btn"
              disabled={state === 'loading'}
              onClick={() => load(fileClass, stage)}
            >
              {state === 'loading' ? 'Loading…' : 'Load'}
            </button>
          </div>

          <div className="browser-status" aria-live="polite">
            {state === 'loading' && <span>Fetching {fileClass} {stageLabel(stage)} from CCCBR…</span>}
            {state === 'loaded' && provenance && (
              <span className="browser-ok">
                Loaded {provenance.methodCount} methods · CCCBR{' '}
                {provenance.upstreamGenerated
                  ? `as of ${provenance.upstreamGenerated}`
                  : `fetched ${new Date(provenance.fetchedAt).toLocaleDateString()}`}
              </span>
            )}
            {state === 'error' && <span className="browser-err">{loadError}</span>}
          </div>
        </div>

        <div className="browser-search">
          <label htmlFor="br-search" className="sr-label">Search loaded methods</label>
          <input
            id="br-search"
            ref={searchRef}
            className="browser-input"
            type="search"
            placeholder={total ? `Search ${total} loaded methods…` : 'Load a set above to search it'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={total === 0}
          />

          <ul className="browser-results">
            {results.map((m) => (
              <li key={m.id ?? `${m.name}|${m.stage}`}>
                <button className="browser-result" onClick={() => onPick(m)}>
                  <span className="browser-result-name">{m.name}</span>
                  <span className="browser-result-meta">{m.classification}</span>
                </button>
              </li>
            ))}
            {total > 0 && results.length === 0 && (
              <li className="browser-empty">No match for “{query}”.</li>
            )}
            {total > MAX_RESULTS && results.length === MAX_RESULTS && (
              <li className="browser-empty">Showing first {MAX_RESULTS} — keep typing to narrow.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
