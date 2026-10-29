"use client"

import { useMemo, useSyncExternalStore } from "react"

import { cssColorToRgb } from "@/lib/css-color"

// The page's theme class ("dark" or not), once it is really on <html>:
// next-themes switches it after React renders.
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })
  return () => observer.disconnect()
}

// Theme tokens (e.g. "--chart-2") as "rgb(r, g, b)" for canvas and WebGL
// libraries, read again whenever the theme changes. Null on the server and
// before the first paint.
export function useThemeColors(tokens: readonly string[]): string[] | null {
  const themeClass = useSyncExternalStore(
    subscribeToTheme,
    () => document.documentElement.className,
    () => null
  )
  const key = tokens.join(" ")
  return useMemo(() => {
    if (themeClass === null) return null
    const styles = getComputedStyle(document.documentElement)
    return key
      .split(" ")
      .map((token) => cssColorToRgb(styles.getPropertyValue(token).trim()))
  }, [themeClass, key])
}

// People who ask their device for less motion get still visuals.
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

function subscribeToMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  )
}
