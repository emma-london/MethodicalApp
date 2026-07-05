import { useEffect, useState } from 'react'

// Android fires this before showing its install prompt; not in the standard lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

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
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault() // keep the event so we can trigger it from our own button
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isMobile = isIOS || /Android/i.test(ua)
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true)

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
    if (!prompt) return
    await prompt.prompt()
    await prompt.userChoice
    dismiss()
  }

  return (
    <div className="install-hint">
      <span className="install-hint__text">
        {isIOS
          ? 'For full screen: tap Share, then “Add to Home Screen”.'
          : 'Add Methodical to your home screen for a full-screen app.'}
      </span>
      {prompt && (
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
