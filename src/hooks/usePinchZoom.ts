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

// WebKit's non-standard gesture events (iOS Safari) aren't in lib.dom.
interface GestureEventLike extends Event {
  scale: number
}

/**
 * Smooth pinch-to-zoom for a single element.
 *
 * Scaling is multiplicative on an internal float, so it never feels "steppy":
 * pinching the finger distance to 2x doubles the value, and the caller rounds
 * only at render time (if at all).
 *
 * Three input paths, chosen for reliability rather than elegance:
 *
 *  1. Touch events (touchstart/move/end) — the cross-browser path for Android.
 *     We call preventDefault() on a two-finger touchmove; this is what actually
 *     stops the browser from page-zooming. CSS `touch-action` alone is NOT
 *     enough on some engines (notably Samsung Internet), which ignore it for
 *     pinch and zoom the whole page — the manual preventDefault is the fix.
 *
 *  2. WebKit gesture events (gesturestart/change/end) — iOS Safari fires these
 *     alongside touch events and gives a direct `scale`. We prefer them there
 *     (guarded by `gestureActive`) so the two paths don't double-apply, and we
 *     preventDefault to stop Safari's page zoom.
 *
 *  3. wheel with ctrlKey — a trackpad pinch on desktop arrives this way.
 *
 * Listeners are bound to `document` so the pinch works anywhere on the page,
 * not just over the content box. They are non-passive so preventDefault can
 * take effect. Single-finger scrolling is untouched (we only cancel two-finger
 * moves), so the page still scrolls normally.
 */
export function usePinchZoom(config: PinchZoomConfig) {
  // Keep the latest config in a ref so the effect binds listeners once (on
  // mount) yet always reads current values/callbacks.
  const cfg = useRef(config)
  cfg.current = config

  useEffect(() => {
    const el: Document = document

    const clamp = (v: number) =>
      Math.min(cfg.current.max, Math.max(cfg.current.min, v))

    // iOS Safari uses gesture events; when active we ignore the touch path so
    // the same pinch isn't counted twice.
    let gestureActive = false

    // --- Touch pinch (Android + generic) ---
    let touchStartDist = 0
    let touchStartValue = 0

    const touchSpread = (touches: TouchList) => {
      const a = touches[0]
      const b = touches[1]
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touchStartDist = touchSpread(e.touches)
        touchStartValue = cfg.current.getValue()
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (gestureActive) return
      if (e.touches.length === 2 && touchStartDist > 0) {
        e.preventDefault() // <-- stops Samsung/Chrome page zoom
        const scale = touchSpread(e.touches) / touchStartDist
        cfg.current.setValue(clamp(touchStartValue * scale))
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) touchStartDist = 0
    }

    // --- iOS Safari gesture events ---
    let gestureStartValue = 0

    const onGestureStart = (e: GestureEventLike) => {
      e.preventDefault()
      gestureActive = true
      gestureStartValue = cfg.current.getValue()
    }
    const onGestureChange = (e: GestureEventLike) => {
      if (!gestureActive) return
      e.preventDefault()
      cfg.current.setValue(clamp(gestureStartValue * e.scale))
    }
    const onGestureEnd = () => {
      gestureActive = false
    }

    // --- Trackpad pinch / ctrl+wheel ---
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return // a trackpad pinch arrives as ctrl+wheel
      e.preventDefault() // otherwise the browser zooms the whole page
      const k = cfg.current.wheelSensitivity ?? 0.01
      const factor = Math.exp(-e.deltaY * k) // deltaY < 0 => zoom in
      cfg.current.setValue(clamp(cfg.current.getValue() * factor))
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    el.addEventListener('gesturestart', onGestureStart as EventListener, { passive: false })
    el.addEventListener('gesturechange', onGestureChange as EventListener, { passive: false })
    el.addEventListener('gestureend', onGestureEnd as EventListener)
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      el.removeEventListener('gesturestart', onGestureStart as EventListener)
      el.removeEventListener('gesturechange', onGestureChange as EventListener)
      el.removeEventListener('gestureend', onGestureEnd as EventListener)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])
}
