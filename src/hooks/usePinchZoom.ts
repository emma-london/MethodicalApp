import { useEffect, useRef } from 'react'

interface PinchZoomConfig {
  /** Lower clamp for the zoom value. */
  min: number
  /** Upper clamp for the zoom value. */
  max: number
  /** Read the current (float) zoom value. */
  getValue: () => number
  /** Apply a new (float) zoom value — do NOT round here; keep it smooth. */
  setValue: (v: number) => void
  /** Trackpad/ctrl-wheel sensitivity. Larger = faster zoom. Default 0.01. */
  wheelSensitivity?: number
}

/**
 * Smooth pinch-to-zoom for a single element.
 *
 * Scaling is multiplicative on an internal float, so it never feels "steppy":
 * a two-finger pinch that doubles the finger distance doubles the value, and
 * the caller rounds only at render time (if at all).
 *
 * Two input paths are handled:
 *  - Touch: two active pointers; value scales by (currentDistance / startDistance).
 *  - Trackpad / ctrl+wheel: browsers report a pinch as a `wheel` event with
 *    `ctrlKey === true`; we map deltaY exponentially so zoom feels linear.
 *
 * The target element should set `touch-action: pan-x pan-y` (see .zoom-surface)
 * so one-finger scrolling still works while the browser's own pinch-zoom is
 * suppressed and handed to us.
 */
export function usePinchZoom<T extends HTMLElement>(config: PinchZoomConfig) {
  const ref = useRef<T | null>(null)
  // Keep the latest config in a ref so the effect can bind listeners once
  // (on mount) yet always read current values/callbacks.
  const cfg = useRef(config)
  cfg.current = config

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const clamp = (v: number) =>
      Math.min(cfg.current.max, Math.max(cfg.current.min, v))

    // --- Touch pinch (two pointers) ---
    const pointers = new Map<number, { x: number; y: number }>()
    let startDist = 0
    let startValue = 0

    const spread = () => {
      const pts = [...pointers.values()]
      if (pts.length < 2) return 0
      const [a, b] = pts
      return Math.hypot(a.x - b.x, a.y - b.y)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) {
        startDist = spread()
        startValue = cfg.current.getValue()
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2 && startDist > 0) {
        e.preventDefault() // stop the page from scrolling/zooming
        const scale = spread() / startDist
        cfg.current.setValue(clamp(startValue * scale))
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) startDist = 0
    }

    // --- Trackpad pinch / ctrl+wheel ---
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return // a trackpad pinch arrives as ctrl+wheel
      e.preventDefault() // otherwise the browser zooms the whole page
      const k = cfg.current.wheelSensitivity ?? 0.01
      const factor = Math.exp(-e.deltaY * k) // deltaY < 0 => zoom in
      cfg.current.setValue(clamp(cfg.current.getValue() * factor))
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove, { passive: false })
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('pointerleave', onPointerUp)
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('pointerleave', onPointerUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  return ref
}
