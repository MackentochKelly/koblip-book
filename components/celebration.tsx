"use client"

import { useEffect } from "react"
import confetti from "canvas-confetti"
import { motion } from "motion/react"

import { cssColorToRgb } from "@/lib/css-color"

// The confetti takes the app's own colours (the home gradient's tokens).
const CONFETTI_TOKENS = ["--primary", "--chart-1", "--hero-accent", "--chart-2"]
// The card pops in a moment after the page, with the confetti.
const POP = { type: "spring", bounce: 0.35, duration: 0.6 } as const

// A burst of confetti in the app's colours. `origin` is where it starts,
// as a share of the screen (0 to 1).
export function celebrate(
  options: Pick<confetti.Options, "particleCount" | "spread" | "origin">
) {
  const styles = getComputedStyle(document.documentElement)
  // canvas-confetti only reads hex colours.
  const colors = CONFETTI_TOKENS.map((token) => {
    const rgb = cssColorToRgb(styles.getPropertyValue(token).trim())
    const parts = rgb.match(/\d+/g) ?? []
    return `#${parts.map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`
  })
  void confetti({
    ...options,
    colors,
    // Nothing flies for people who turned motion off.
    disableForReducedMotion: true,
  })
}

// The app's one "it worked" moment: confetti once, then a picture, a title,
// a line under it, the details and the buttons pop in
// (github.com/catdad/canvas-confetti). Used when an owner's page goes live
// and when a customer books.
export function Celebration({
  media,
  title,
  description,
  children,
  actions,
}: {
  media: React.ReactNode
  title: string
  description: string
  children?: React.ReactNode
  actions: React.ReactNode
}) {
  useEffect(() => {
    celebrate({ particleCount: 120, spread: 80, origin: { y: 0.35 } })
    return () => {
      confetti.reset()
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={POP}
      className="flex flex-col items-center gap-6 text-center"
    >
      {media}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {children}
      <div className="flex w-full flex-col gap-3">{actions}</div>
    </motion.div>
  )
}
