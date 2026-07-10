import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Row, standardCalls, bellToChar } from 'ringing-lib-ts'
import type { Method, CallDefinition } from 'ringing-lib-ts'
import type { MethodDef } from '../data/methods'
import { METHODS } from '../data/methods'
import { SPLICE_SETS } from '../data/spliceSets'
import { buildMethod, generateLeads, placeBellName } from '../logic/course'
import type { LeadMethod } from '../logic/course'
import MethodPicker from './MethodPicker'
import Dropdown from './Dropdown'

interface Props {
  method: MethodDef
  methodName: string
  onMethodChange: (name: string) => void
}

type Mode = 'plain' | 'touch'
type Move = -1 | 0 | 1

interface Session {
  rows: Row[]
  callsAt: Map<number, string>
  callMarks: Map<number, string>
  methodAt: Map<number, string>
  methodMarks: Map<number, string>
  leadMethodAt: Map<number, string>
}

const INITIAL_LEADS = 8
const EXTEND_LEADS = 8
// Append more leads once the current position is within this many rows of the end.
const EXTEND_BUFFER = 40

// Grandsire's call work starts two blows before the treble's first lead blow.
const offsetFor = (name: string) => (/grandsire/i.test(name) ? 2 : 0)

function safeStandardCalls(m: Method): CallDefinition[] {
  try {
    return standardCalls(m)
  } catch {
    return []
  }
}

// Practice-touch policy (app-level, not library truth): which of a method's
// standard calls the trainer is allowed to throw at random. Singles are still
// real calls of the method — we just keep random Plain Bob Doubles practice to
// bobs only, since stray singles give untypical little touches.
function practiceCalls(methodName: string, calls: CallDefinition[]): CallDefinition[] {
  if (/^plain bob doubles$/i.test(methodName.trim())) {
    return calls.filter((c) => c.name.toLowerCase() !== 'single')
  }
  return calls
}

const EMPTY_SESSION: Session = {
  rows: [],
  callsAt: new Map(),
  callMarks: new Map(),
  methodAt: new Map(),
  methodMarks: new Map(),
  leadMethodAt: new Map(),
}

export default function MethodTrainer({ method, methodName, onMethodChange }: Props) {
  const [mode, setMode] = useState<Mode>('plain')
  const [spliceMode, setSpliceMode] = useState(false)
  const [spliceSetName, setSpliceSetName] = useState<string>(SPLICE_SETS[0]?.name ?? '')
  const [workingBell, setWorkingBell] = useState(1)
  const [seed, setSeed] = useState(0) // bump to restart
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err' | 'done'; msg: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const currentRowRef = useRef<HTMLDivElement>(null)
  const moveRef = useRef<(m: Move) => void>(() => {})

  const spliceSet = SPLICE_SETS.find((s) => s.name === spliceSetName) ?? SPLICE_SETS[0]
  const usingSplice = spliceMode && !!spliceSet
  const effectiveStage = usingSplice ? spliceSet.stage : method.stage
  const wb = Math.min(workingBell, effectiveStage - 1)

  // Lead length for the single-method case, used to locate lead heads (where a
  // place bell is shown). Spliced sessions locate lead heads via methodMarks.
  const singleLeadLength = useMemo(() => {
    if (usingSplice) return 0
    try {
      return buildMethod(method).leadLength
    } catch {
      return 0
    }
  }, [usingSplice, method])

  const [session, setSession] = useState<Session>(EMPTY_SESSION)

  // Build the list of candidate methods for a lead — one entry (single mode) or
  // the whole set (spliced). Shared by the initial build and by `extend`.
  const buildLeadMethods = useCallback((): LeadMethod[] => {
    const withCalls = mode === 'touch'
    if (usingSplice) {
      return spliceSet.methods.flatMap((name) => {
        const def = METHODS.find((mm) => mm.name === name)
        if (!def) return []
        const m = buildMethod(def)
        return [{ method: m, calls: withCalls ? practiceCalls(name, safeStandardCalls(m)) : [], trebleLeadOffset: offsetFor(name) }]
      })
    }
    const m = buildMethod(method)
    return [{ method: m, calls: withCalls ? practiceCalls(method.name, safeStandardCalls(m)) : [], trebleLeadOffset: offsetFor(method.name) }]
  }, [usingSplice, spliceSet, method, mode])

  // (Re)build the session whenever the method/set, mode, or restart seed changes.
  useEffect(() => {
    try {
      const leadMethods = buildLeadMethods()
      if (leadMethods.length === 0) throw new Error('No methods available')
      const rounds = Row.rounds(leadMethods[0].method.stage)
      const b = generateLeads(leadMethods, rounds, INITIAL_LEADS, 0)
      setSession({
        rows: [rounds, ...b.rows],
        callsAt: b.callsAt,
        callMarks: b.callMarks,
        methodAt: b.methodAt,
        methodMarks: b.methodMarks,
        leadMethodAt: b.leadMethodAt,
      })
      setError(null)
    } catch (e) {
      setSession(EMPTY_SESSION)
      setError((e as Error).message)
    }
    setIndex(0)
    setFeedback(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildLeadMethods, seed])

  const { rows, callsAt, callMarks, methodAt, methodMarks, leadMethodAt } = session

  // Append more leads so the session never runs out.
  const extend = useCallback(() => {
    setSession((prev) => {
      if (prev.rows.length === 0) return prev
      try {
        const leadMethods = buildLeadMethods()
        if (leadMethods.length === 0) return prev
        const last = prev.rows[prev.rows.length - 1]
        const b = generateLeads(leadMethods, last, EXTEND_LEADS, prev.rows.length - 1)
        const mergeInto = <T,>(base: Map<number, T>, extra: Map<number, T>) => {
          const next = new Map(base)
          extra.forEach((v, k) => next.set(k, v))
          return next
        }
        return {
          rows: [...prev.rows, ...b.rows],
          callsAt: mergeInto(prev.callsAt, b.callsAt),
          callMarks: mergeInto(prev.callMarks, b.callMarks),
          methodAt: mergeInto(prev.methodAt, b.methodAt),
          methodMarks: mergeInto(prev.methodMarks, b.methodMarks),
          leadMethodAt: mergeInto(prev.leadMethodAt, b.leadMethodAt),
        }
      } catch {
        return prev
      }
    })
  }, [buildLeadMethods])

  // Keep the current row in view (centred above the sticky control bar).
  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' })
  }, [index, rows])

  // Keyboard shortcuts: V = Down, B = Place, N = Up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const move: Move | null = e.key === 'v' || e.key === 'V' ? -1
        : e.key === 'b' || e.key === 'B' ? 0
        : e.key === 'n' || e.key === 'N' ? 1
        : null
      if (move !== null) {
        e.preventDefault()
        moveRef.current(move)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const requiredMove: Move | null =
    index + 1 < rows.length
      ? (Math.sign(rows[index + 1].toArray().indexOf(wb) - rows[index].toArray().indexOf(wb)) as Move)
      : null

  const currentCall = callsAt.get(index) ?? null
  const currentMethodBanner = usingSplice ? (methodAt.get(index) ?? null) : null
  const currentMethodName = usingSplice
    ? (leadMethodAt.get(index) ?? methodAt.get(index) ?? '…')
    : method.name

  const handleMove = (move: Move) => {
    if (requiredMove === null) return
    if (move === requiredMove) {
      const next = index + 1
      setIndex(next)
      if (next >= rows.length - EXTEND_BUFFER) extend()
      setFeedback(
        rows[next].isRounds()
          ? { kind: 'done', msg: '🎉 Rounds! Keep going…' }
          : { kind: 'ok', msg: 'Correct — next row.' },
      )
    } else {
      setFeedback({ kind: 'err', msg: 'Not quite — try again. Watch where your bell needs to go.' })
    }
  }
  // Keep the keyboard handler pointing at the current closure.
  moveRef.current = handleMove

  const restart = () => setSeed((s) => s + 1)

  if (error) return <p className="feedback err">Could not build method: {error}</p>

  // Show a trailing window of revealed rows.
  const from = Math.max(0, index - 9)
  const revealed = rows.slice(from, index + 1)

  return (
    <div className="trainer">
      <div className="controls">
        <MethodPicker
          methodName={methodName}
          onMethodChange={onMethodChange}
          spliceMode={spliceMode}
          onSpliceModeChange={setSpliceMode}
          spliceSetName={spliceSetName}
          onSpliceSetChange={setSpliceSetName}
        />
        <div className="field">
          <label htmlFor="tr-wb">Your bell</label>
          <Dropdown
            id="tr-wb"
            value={String(wb)}
            onChange={(v) => setWorkingBell(Number(v))}
            ariaLabel="Your bell"
            options={Array.from({ length: effectiveStage - 1 }, (_, i) => i + 1).map((b) => ({
              value: String(b),
              label: bellToChar(b),
            }))}
          />
        </div>
        <div className="seg" role="tablist" aria-label="Mode">
          <button className={mode === 'plain' ? 'active' : ''} onClick={() => setMode('plain')}>Plain course</button>
          <button className={mode === 'touch' ? 'active' : ''} onClick={() => setMode('touch')}>Touch</button>
        </div>
        <button className="btn" onClick={restart}>Restart</button>
      </div>

      <p className="meta">
        You are ringing <strong>{bellToChar(wb)}</strong> ·{' '}
        {usingSplice ? (
          <>
            {spliceSet.name} — <strong>{currentMethodName}</strong>
          </>
        ) : (
          method.name
        )}{' '}
        · {mode === 'touch' ? 'touch (endless)' : 'plain course (endless)'} · row {index + 1}
      </p>

      <div className="trainer-rows-area">
        <div className="trainer-rows">
          {revealed.map((row, i) => {
            const absolute = from + i
            const isCurrent = absolute === index
            const mark = callMarks.get(absolute)
            const mMark = usingSplice ? methodMarks.get(absolute) : undefined
            // A lead head: row 0 (rounds) plus every method-mark row (spliced),
            // or every `singleLeadLength` rows (single method). Show the place
            // bell the ringer's own bell rings for the lead starting here.
            const isLeadHead = usingSplice
              ? absolute === 0 || methodMarks.has(absolute)
              : singleLeadLength > 0 && absolute % singleLeadLength === 0
            const pbMark = isLeadHead
              ? placeBellName(row.toArray().indexOf(wb) + 1)
              : undefined
            return (
              <div
                key={absolute}
                ref={isCurrent ? currentRowRef : undefined}
                className={isCurrent ? 'row current' : 'row'}
              >
                {row.toArray().map((bell, pos) => (
                  <span key={pos} className={bell === wb ? 'b-work' : bell === 0 ? 'b-treble' : undefined}>
                    {bellToChar(bell)}
                  </span>
                ))}
                {(mMark || pbMark) && (
                  <span className="lead-marks">
                    {mMark && <span className="lead-pill lead-pill--method">{mMark}</span>}
                    {pbMark && (
                      <span className="lead-pill lead-pill--pb" title={`${pbMark} place bell`}>
                        {pbMark}
                      </span>
                    )}
                  </span>
                )}
                {mark && <span className={`call-mark call-mark--${mark.toLowerCase()}`}>{mark}</span>}
              </div>
            )
          })}
          <div className="row placeholder">{'·'.repeat(effectiveStage)}</div>
        </div>
      </div>

      <div className="trainer-controls">
        <div className="trainer-controls-inner">
          {usingSplice && (
            <div className={currentMethodBanner ? 'method-banner show' : 'method-banner'} aria-live="polite">
              {currentMethodBanner ? `→ ${currentMethodBanner}` : ''}
            </div>
          )}

          <div className={currentCall ? 'call-banner show' : 'call-banner'} aria-live="assertive">
            {currentCall ? `🔔 ${currentCall}!` : ''}
          </div>

          {feedback ? (
            <div className={`feedback ${feedback.kind}`}>{feedback.msg}</div>
          ) : (
            <div className="feedback">Move your bell to the next row.</div>
          )}

          <div className="move-buttons">
            <button className="down" onClick={() => handleMove(-1)}>
              <span className="sym">◀</span> Down <kbd>V</kbd>
            </button>
            <button className="stay" onClick={() => handleMove(0)}>
              <span className="sym">■</span> Place <kbd>B</kbd>
            </button>
            <button className="up" onClick={() => handleMove(1)}>
              Up <span className="sym">▶</span> <kbd>N</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
