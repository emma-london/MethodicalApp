import { useEffect, useId, useRef, useState } from 'react'

export interface DropdownOption {
  value: string
  label: string
}

interface Props {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  /** id for the trigger button, so a <label htmlFor> can point at it. */
  id?: string
  ariaLabel?: string
  /** Give the menu a taller cap (e.g. the Stage list, which should fit fully). */
  tallMenu?: boolean
}

/**
 * A small, accessible dropdown that replaces the native <select>.
 *
 * We use this instead of <select> because native selects render the OS picker
 * (radio-button rows on Android, a wheel + "Done" on iOS) which we can't style.
 * This gives a consistent, compact look on every browser. It supports mouse,
 * touch, and keyboard (arrows / Home / End / Enter / Escape), closes on outside
 * click, and exposes listbox/option roles for assistive tech.
 */
export default function Dropdown({ value, options, onChange, id, ariaLabel, tallMenu }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const listId = useId()

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))
  const selected = options[selectedIndex]

  // Close when the user interacts outside the control.
  useEffect(() => {
    if (!open) return
    const onDocPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointer)
    return () => document.removeEventListener('pointerdown', onDocPointer)
  }, [open])

  // Open onto the current selection.
  useEffect(() => {
    if (open) setActive(selectedIndex)
  }, [open, selectedIndex])

  // Keep the highlighted option in view while navigating.
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[active] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const choose = (i: number) => {
    const opt = options[i]
    if (opt) onChange(opt.value)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((a) => Math.min(options.length - 1, a + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => Math.max(0, a - 1))
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(options.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
    }
  }

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        type="button"
        id={id}
        className="dropdown-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span className="dropdown-label">{selected?.label ?? ''}</span>
        <span className="dropdown-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul
          className={'dropdown-menu' + (tallMenu ? ' dropdown-menu--tall' : '')}
          role="listbox"
          id={listId}
          ref={listRef}
          tabIndex={-1}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={
                'dropdown-option' +
                (o.value === value ? ' is-selected' : '') +
                (i === active ? ' is-active' : '')
              }
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
