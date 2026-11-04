import { expect, test, vi } from "vitest"

import { VOICE_RULES } from "@/lib/voice-rules"

import { createSilenceWatch } from "./silence-watch"

const STEP = 43
const WAIT = VOICE_RULES.earlyAnswerAfterQuietMs

function run(levels: number[]) {
  const onQuiet = vi.fn()
  const watch = createSilenceWatch(onQuiet)
  levels.forEach((level, index) => watch.hear(level, index * STEP))
  return { onQuiet, watch }
}
const frames = (ms: number, level: number) =>
  Array.from({ length: Math.ceil(ms / STEP) }, () => level)

test("quiet after speech is told once, after the wait", () => {
  const speech = [...frames(200, 0.001), ...frames(400, 0.4)]
  const early = run([...speech, ...frames(WAIT - STEP * 2, 0.001)])
  expect(early.onQuiet).not.toHaveBeenCalled()
  const late = run([...speech, ...frames(WAIT * 3, 0.001)])
  expect(late.onQuiet).toHaveBeenCalledTimes(1)
})

test("a short breath in the middle tells nothing", () => {
  const { onQuiet } = run([
    ...frames(200, 0.001),
    ...frames(400, 0.4),
    ...frames(WAIT / 2, 0.001),
    ...frames(400, 0.4),
  ])
  expect(onQuiet).not.toHaveBeenCalled()
})

test("silence with no speech before it tells nothing", () => {
  expect(run(frames(3000, 0.001)).onQuiet).not.toHaveBeenCalled()
})

test("each stretch of speech is told once", () => {
  const stretch = [...frames(400, 0.4), ...frames(WAIT * 2, 0.001)]
  const { onQuiet } = run([...frames(200, 0.001), ...stretch, ...stretch])
  expect(onQuiet).toHaveBeenCalledTimes(2)
})

test("speech over a steady room noise still ends", () => {
  const { onQuiet } = run([
    ...frames(500, 0.05),
    ...frames(400, 0.4),
    ...frames(WAIT * 2, 0.05),
  ])
  expect(onQuiet).toHaveBeenCalledTimes(1)
})

test("the owner's last sound is remembered", () => {
  const { watch } = run([...frames(100, 0.001), 0.4, ...frames(200, 0.001)])
  expect(watch.lastVoiceAt()).toBe(Math.ceil(100 / STEP) * STEP)
})
