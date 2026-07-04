import { useCallback, useEffect, useRef, useState } from 'react'
import { Row, standardCalls, bellToChar } from 'ringing-lib-ts'
import type { Method, CallDefinition } from 'ringing-lib-ts'
import type { MethodDef } from '../data/methods'
import { buildMethod, generateLeads } from '../logic/course'
import MethodPicker from './MethodPicker'

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
}

const INITIAL_LEADS = 8
const EXTEND_LEADS = 8
// Append more leads once the current position is within this many rows of the end.
const EXTEND_BUFFER = 40

function safeStandardCalls(m: Method): CallDefinition[] {
  try {
    return standardCalls(m)
  } catch {
    return []
  }
}

function makeSession(def: MethodDef, mode: Mode, trebleLeadOffset: number): Session {
  const m = buildMethod(def)
  const calls = mode === 'touch' ? safeStandardCalls(m) : []
  const rounds = Row.rounds(m.stage)
  const b = generateLeads(m, rounds, INITIAL_LEADS, calls, trebleLeadOffset, 0)
  return { rows: [rounds, ...b.rows], callsAt: b.callsAt, callMarks: b.callMarks }
}

const EMPTY_SESSION: Session = { rows: [], callsAt: new Map(), callMarks: new Map() }

export default function MethodTrainer({ method, methodName, onMethodChange }: Props) {
  const [mode, setMode] = useState<Mode>('plain')
  const [workingBell, setWorkingBell] = useState(1)
  const [seed, setSeed] = useState(0) // bump to restart
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err' | 'done'; msg: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const currentRowRef = useRef<HTMLDivElement>(null)
  const moveRef = useRef<(m: Move) => void>(() => {})

  const wb = Math.min(workingBell, method.stage - 1)
  // Grandsire's call work starts two blows before the treble's first lead blow.
  const trebleLeadOffset = /grandsire/i.test(method.name) ? 2 : 0

  const [session, setSession] = useState<Session>(EMPTY_SESSION)

  // (Re)build the session whenever the method, mode, or restart seed changes.
  useEffect(() => {
    try {
      setSession(makeSession(method, mode, trebleLeadOffset))
      setError(null)
    } catch (e) {
      setSession(EMPTY_SESSION)
      setError((e as Error).message)
    }
    setIndex(0)
    setFeedback(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, mode, seed, trebleLeadOffset])

  const { rows, callsAt, callMarks } = session

  // Append more leads so the session never runs out.
  const extend = useCallback(() => {
    setSession((prev) => {
      if (prev.rows.length === 0) return prev
      try {
        const m = buildMethod(method)
        const calls = mode === 'touch' ? safeStandardCalls(m) : []
        const last = prev.rows[prev.rows.length - 1]
        const b = generateLeads(m, last, EXTEND_LEADS, calls, trebleLeadOffset, prev.rows.length - 1)
        const nextCallsAt = new Map(prev.callsAt)
        b.callsAt.forEach((v, k) => nextCallsAt.set(k, v))
        const nextCallMarks = new Map(prev.callMarks)
        b.callMarks.forEach((v, k) => nextCallMarks.set(k, v))
        return { rows: [...prev.rows, ...b.rows], callsAt: nextCallsAt, callMarks: nextCallMarks }
      } catch {
        return prev
      }
    })
  }, [method, mode, trebleLeadOffset])

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
        <MethodPicker methodName={methodName} onMethodChange={onMethodChange} />
        <div className="field">
          <label htmlFor="tr-wb">Your bell</label>
          <select id="tr-wb" value={wb} onChange={(e) => setWorkingBell(Number(e.target.value))}>
            {Array.from({ length: method.stage - 1 }, (_, i) => i + 1).map((b) => (
              <option key={b} value={b}>{bellToChar(b)}</option>
            ))}
          </select>
        </div>
        <div className="seg" role="tablist" aria-label="Mode">
          <button className={mode === 'plain' ? 'active' : ''} onClick={() => setMode('plain')}>Plain course</button>
          <button className={mode === 'touch' ? 'active' : ''} onClick={() => setMode('touch')}>Touch</button>
        </div>
        <button className="btn" onClick={restart}>Restart</button>
      </div>

      <p className="meta">
        You are ringing <strong>{bellToChar(wb)}</strong> · {method.name} ·{' '}
        {mode === 'touch' ? 'touch (endless)' : 'plain course (endless)'} · row {index + 1}
      </p>

      <div className="trainer-rows-area">
        <div className="trainer-rows">
          {revealed.map((row, i) => {
            const absolute = from + i
            const isCurrent = absolute === index
            const mark = callMarks.get(absolute)
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
                {mark && <span className={`call-mark call-mark--${mark.toLowerCase()}`}>{mark}</span>}
              </div>
            )
          })}
          <div className="row placeholder">{'·'.repeat(method.stage)}</div>
        </div>
      </div>

      <div className="trainer-controls">
        <div className="trainer-controls-inner">
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
