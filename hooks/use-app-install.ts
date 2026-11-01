"use client"

import { useSyncExternalStore } from "react"

// Chrome's install event (web.dev/articles/customize-install); not yet in
// TypeScript's DOM types.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// How this device installs the app: "prompt" = the browser's own Install
// button (Chrome, Edge, Android), "ios" = Share then Add to Home Screen,
// "other" = neither (open it on a phone instead), "installed" = it already
// runs as the app. null while the page is still loading.
export type AppInstallWay = "prompt" | "ios" | "other" | "installed"

// The browser's saved install event, kept for the whole visit so it isn't
// lost when Home re-renders.
let promptEvent: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((listener) => listener())

function onBeforeInstallPrompt(event: Event) {
  // Keep the browser's own banner from showing; our button opens it.
  event.preventDefault()
  promptEvent = event as BeforeInstallPromptEvent
  changed()
}

function onInstalled() {
  promptEvent = null
  changed()
}

const STANDALONE = "(display-mode: standalone)"

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onInstalled)
  }
  listeners.add(listener)
  const standalone = window.matchMedia(STANDALONE)
  standalone.addEventListener("change", listener)
  return () => {
    standalone.removeEventListener("change", listener)
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }
}

function isIOS() {
  // iPads ask for desktop pages and say "Macintosh"; touch gives them away.
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  )
}

function getSnapshot(): AppInstallWay {
  if (
    window.matchMedia(STANDALONE).matches ||
    ("standalone" in navigator && navigator.standalone === true)
  ) {
    return "installed"
  }
  if (promptEvent) return "prompt"
  return isIOS() ? "ios" : "other"
}

const getServerSnapshot = () => null

// How to install Koblip Book on this device, and the browser's Install
// window for "prompt" (nextjs.org/docs/app/guides/progressive-web-apps).
export function useAppInstall() {
  const way = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const install = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    // An install event works once; after an answer the browser sends a new
    // one if the app can still be installed.
    promptEvent = null
    changed()
  }

  return { way, install }
}
