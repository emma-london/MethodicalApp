import { useState } from 'react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

/**
 * A permanent install affordance in the header — available even after the
 * banner has been dismissed, since installing gives a much better experience.
 *
 * Android: triggers the captured install prompt directly.
 * iOS: has no programmatic install, so it toggles a short "Share → Add to Home
 * Screen" instruction popover instead.
 * Hidden when already running standalone or on desktop (no install path).
 */
export default function InstallButton() {
  const { isIOS, isStandalone, canPrompt, triggerInstall } = useInstallPrompt()
  const [showHelp, setShowHelp] = useState(false)

  const visible = !isStandalone && (canPrompt || isIOS)
  if (!visible) return null

  const onClick = () => {
    if (canPrompt) triggerInstall()
    else setShowHelp((s) => !s)
  }

  return (
    <div className="install-btn-wrap">
      <button
        className="install-btn"
        onClick={onClick}
        aria-label="Install app"
        aria-expanded={isIOS ? showHelp : undefined}
      >
        <span className="install-btn__icon" aria-hidden="true">⤓</span>
        <span className="install-btn__label">Install</span>
      </button>
      {isIOS && showHelp && (
        <div className="install-pop" role="dialog" aria-label="How to install">
          Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
          <button
            className="install-pop__close"
            onClick={() => setShowHelp(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
