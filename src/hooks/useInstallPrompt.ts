import { useEffect, useState } from 'react'

// Android fires this before showing its install prompt; not in the standard lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// The `beforeinstallprompt` event fires once, early, and can only be used by one
// listener. So we capture it at module load into a singleton and let any number
// of components subscribe — this way both the banner and the header button can
// offer install without fighting over the event.
let deferredPrompt: BeforeInstallPromptEvent | null = null
const subscribers = new Set<() => void>()
const notify = () => subscribers.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // stop the mini-infobar; we trigger it from our own UI
    deferredPrompt = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export interface InstallInfo {
  isIOS: boolean
  isMobile: boolean
  isStandalone: boolean
  /** Android programmatic install is available (event captured). */
  canPrompt: boolean
  /** Trigger the Android install prompt. Resolves with the user's choice. */
  triggerInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

export function useInstallPrompt(): InstallInfo {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force((n) => n + 1)
    subscribers.add(fn)
    return () => {
      subscribers.delete(fn)
    }
  }, [])

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isMobile = isIOS || /Android/i.test(ua)
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true)

  const triggerInstall = async () => {
    if (!deferredPrompt) return 'unavailable' as const
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    deferredPrompt = null
    notify()
    return choice.outcome
  }

  return { isIOS, isMobile, isStandalone, canPrompt: deferredPrompt !== null, triggerInstall }
}
