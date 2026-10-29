"use client"

import { MotionConfig } from "motion/react"

// Every Motion animation follows the phone's or computer's Reduce Motion
// setting: movement turns off, fades stay
// (motion.dev/docs/react-accessibility).
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
