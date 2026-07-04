import { useEffect, useMemo, useState } from 'react'
import { bellToChar } from 'ringing-lib-ts'
import type { MethodDef } from '../data/methods'
import { buildMethod, plainCourseRows, randomTouchRows } from '../logic/course'
import MethodPicker from './MethodPicker'

interface Props {
  method: MethodDef
  methodName: string
  onMethodChange: (name: string) => void
}

type Mode = 'plain' | 'touch'
type Move = -1 | 0 | 1

export default function MethodTrainer({ method, methodName, onMethodChange }: Props) {
  const [mode, setMode] = useState<Mode>('plain')
  const [workingBell, setWorkingBell] = useState(1)
  const [seed, setSeed] = useState(0) // bump to regenerate a touch / restart
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err' | 'done'; msg: string } | null>(null)

  const wb = Math.min(workingBell, method.stage - 1)

  const { rows, calling, error } = useMemo(() => {
    try {
      const m = buildMethod(method)
      if (mode === 'plain') return { rows: plainCourseRows(m), calling: '', error: null as string | null }
      const t = randomTouchRows(m)
      return { rows: t.rows, calling: t.calling, error: null }
    } catch (e) {
      return { rows: [], calling: '', error: (e as Error).message }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, mode, seed])

  // Restart whenever the exercise changes.
  useEffect(() => {
    setIndex(0)
    setFeedback(null)
  }, [rows])

  if (error) return <p className="feedback err">Could not build method: {error}</p>

  const finished = index >= rows.length - 1
  const requiredMove: Move | null = finished
    ? null
    : (Math.sign(
        rows[index + 1].toArray().indexOf(wb) - rows[index].toArray().indexOf(wb),
      ) as Move)

  const handleMove = (move: Move) => {
    if (finished) return
    if (move === requiredMove) {
      const next = index + 1
      setIndex(next)
      if (next >= rows.length - 1) {
        setFeedback({ kind: 'done', msg: '🎉 That’s all — it comes round!' })
      } else {
        setFeedback({ kind: 'ok', msg: 'Correct — next row.' })
      }
    } else {
      setFeedback({ kind: 'err', msg: 'Not quite — try again. Watch where your bell needs to go.' })
    }
  }

  const restart = () => setSeed((s) => s + 1)

  // Show a trailing window of revealed rows.
  const from = Math.max(0, index - 7)
  const revealed = rows.slice(from, index + 1)

  return (
    <div>
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
        You are ringing <strong>{bellToChar(wb)}</strong> · {method.name}
        {mode === 'touch' && calling ? <> · touch: <code>{calling}</code></> : null}
        {' '}· row {index + 1} of {rows.length}
      </p>

      <div className="trainer-stage">
        <div className="trainer-rows">
          {revealed.map((row, i) => {
            const absolute = from + i
            const isCurrent = absolute === index
            return (
              <div key={absolute} className={isCurrent ? 'row current' : 'row'}>
                {row.toArray().map((bell, pos) => (
                  <span key={pos} className={bell === wb ? 'b-work' : bell === 0 ? 'b-treble' : undefined}>
                    {bellToChar(bell)}
                  </span>
                ))}
              </div>
            )
          })}
          {!finished && <div className="row placeholder">{'·'.repeat(method.stage)}</div>}
        </div>

        <div className="move-buttons">
          <button className="down" onClick={() => handleMove(-1)} disabled={finished}>▼ Down a place</button>
          <button className="stay" onClick={() => handleMove(0)} disabled={finished}>■ Make places</button>
          <button className="up" onClick={() => handleMove(1)} disabled={finished}>▲ Up a place</button>
        </div>

        {feedback && <div className={`feedback ${feedback.kind}`}>{feedback.msg}</div>}
        {!feedback && <div className="feedback">Move your bell to the next row.</div>}
      </div>
    </div>
  )
}
