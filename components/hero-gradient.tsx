"use client"

import { useMemo, useSyncExternalStore } from "react"
import { MeshGradient } from "@paper-design/shaders-react"

import { cssColorToRgb } from "@/lib/css-color"

// Paper's Mesh Gradient (https://shaders.paper.design/mesh-gradient): a
// slow fluid colour wash, set up once for the app. The colours are theme
// tokens from globals.css, read in the browser so a new theme recolours it.
const HERO_GRADIENT = {
  colorTokens: ["--background", "--chart-1", "--hero-accent", "--chart-2"],
  distortion: 0.4,
  swirl: 0.1,
  speed: 0.3,
} as const

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

// People who ask their device for less motion get a still gradient.
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

function subscribeToMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

// Fills its `relative isolate` parent, behind the content.
export function HeroGradient() {
  const themeClass = useSyncExternalStore(
    subscribeToTheme,
    () => document.documentElement.className,
    () => null
  )
  const still = useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  )
  const colors = useMemo(() => {
    if (themeClass === null) return null
    const styles = getComputedStyle(document.documentElement)
    return HERO_GRADIENT.colorTokens.map((token) =>
      cssColorToRgb(styles.getPropertyValue(token).trim())
    )
  }, [themeClass])

  return (
    // Rounded on its own, with the box's corner size: iPhone Safari draws
    // this moving layer apart from the page and, while the page around it
    // changes (the phone search opening), stops clipping it to the box's
    // rounded corners for a moment, so they flash square.
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 [clip-path:inset(0_round_var(--radius-4xl))]"
    >
      {colors && (
        <MeshGradient
          colors={colors}
          distortion={HERO_GRADIENT.distortion}
          swirl={HERO_GRADIENT.swirl}
          speed={still ? 0 : HERO_GRADIENT.speed}
          // Fades in over the plain page colour instead of popping in.
          className="size-full duration-700 motion-safe:animate-in motion-safe:fade-in"
        />
      )}
    </div>
  )
}
