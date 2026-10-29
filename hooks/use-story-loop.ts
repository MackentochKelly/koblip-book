"use client"

import { useEffect, useEffectEvent, useState, type RefObject } from "react"
import { useInView } from "motion/react"

import { useReducedMotion } from "@/hooks/use-theme-colors"
import { SHOWCASE_LOOP } from "@/lib/showcase-rules"

const STOPPED = Symbol("stopped")

export type Wait = (ms: number) => Promise<void>

// Plays a little story over and over while `box` is on screen: `round`
// plays one round (await `wait` between moves), then after
// SHOWCASE_LOOP.rounds it rests on `rest`'s picture. Leaving the screen
// stops it on that picture too. Reduce Motion: only that picture. Returns
// `replay`, for a button that plays it again.
export function useStoryLoop(
  box: RefObject<HTMLElement | null>,
  round: (wait: Wait) => Promise<void>,
  rest: () => void
) {
  const inView = useInView(box, { amount: SHOWCASE_LOOP.inView })
  const still = useReducedMotion()
  const [run, setRun] = useState(0)
  const playRound = useEffectEvent(round)
  const toRest = useEffectEvent(rest)

  useEffect(() => {
    if (!inView || still) return
    let stopped = false
    const wait: Wait = (ms) =>
      new Promise((done, fail) =>
        setTimeout(() => (stopped ? fail(STOPPED) : done()), ms)
      )
    async function play() {
      try {
        for (let count = 0; count < SHOWCASE_LOOP.rounds; count++) {
          await playRound(wait)
        }
        toRest()
      } catch (error) {
        if (error !== STOPPED) throw error
      }
    }
    void play()
    return () => {
      stopped = true
      toRest()
    }
  }, [inView, still, run])

  return () => setRun((count) => count + 1)
}
