import { useState } from 'react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

const DISMISS_KEY = 'methodical-install-hint-dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * A dismissible hint shown only to mobile users who are browsing in a tab
 * (not already launched from the home screen), pointing them at "Add to Home
 * Screen" for the full-screen standalone experience.
 */
export default function InstallHint() {
  const [dismissed, setDismissed] = useState(readDismissed)
  const { isIOS, isMobile, isStandalone, canPrompt, triggerInstall } = useInstallPrompt()

  if (dismissed || isStandalone || !isMobile) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore (private mode) */
    }
  }

  const install = async () => {
    await triggerInstall()
    dismiss()
  }

  return (
    <div className="install-hint">
      <span className="install-hint__text">
        {isIOS
          ? 'For full screen: tap Share, then “Add to Home Screen”.'
          : 'Add Methodical to your home screen for a full-screen app.'}
      </span>
      {canPrompt && (
        <button className="install-hint__install" onClick={install}>
          Install
        </button>
      )}
      <button className="install-hint__close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
