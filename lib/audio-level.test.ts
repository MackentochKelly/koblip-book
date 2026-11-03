import { expect, test } from "vitest"

import { audioLevel } from "./audio-level"

test("level is 0 for silence and capped at 1", () => {
  expect(audioLevel(new Float32Array(10))).toBe(0)
  expect(audioLevel(new Float32Array(10).fill(1))).toBe(1)
})
