"use client"

import { useEffect, useState } from "react"

import { useReducedMotion } from "@/hooks/use-theme-colors"

// How long each letter takes to type (erasing is twice as fast), and how
// long each example line stays before it's erased.
const SPEED = 80
const HOLD = 1200

// A search box hint that types and erases a few example lines once, then
// types `rest` and stays on it. Stops at once (showing `rest`) when
// `paused` (the box is in use) or with Reduce Motion. Screen readers get
// the box's fixed label, not this.
export function useTypingPlaceholder({
  lines,
  rest,
  paused,
}: {
  lines: readonly string[]
  rest: string
  paused: boolean
}) {
  const still = useReducedMotion()
  const [text, setText] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Once the box is used, it never starts again.
  if (paused && !done) setDone(true)

  useEffect(() => {
    if (still || done) return
    const steps: { text: string; wait: number }[] = []
    for (const line of [...lines, rest]) {
      for (let i = 1; i <= line.length; i++)
        steps.push({ text: line.slice(0, i), wait: SPEED })
      if (line === rest) break
      steps.push({ text: line, wait: HOLD })
      for (let i = line.length - 1; i >= 0; i--)
        steps.push({ text: line.slice(0, i), wait: SPEED / 2 })
    }
    let step = 0
    let timer: ReturnType<typeof setTimeout>
    const next = () => {
      if (step >= steps.length) {
        setDone(true)
        return
      }
      const { text: shown, wait } = steps[step++]
      setText(shown)
      timer = setTimeout(next, wait)
    }
    timer = setTimeout(next, 600)
    return () => clearTimeout(timer)
  }, [still, done, lines, rest])

  if (still || done || text === null) return rest
  return text
}
