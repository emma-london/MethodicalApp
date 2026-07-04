import { METHODS, STAGE_NAMES } from '../data/methods'

interface Props {
  methodName: string
  onMethodChange: (name: string) => void
}

export default function MethodPicker({ methodName, onMethodChange }: Props) {
  return (
    <div className="field">
      <label htmlFor="method-select">Method</label>
      <select id="method-select" value={methodName} onChange={(e) => onMethodChange(e.target.value)}>
        {METHODS.map((m) => (
          <option key={m.name} value={m.name}>
            {m.name} ({STAGE_NAMES[m.stage] ?? m.stage})
          </option>
        ))}
      </select>
    </div>
  )
}
