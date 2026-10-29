import { expect, test } from "vitest"

import {
  base64Pcm16ToFloat,
  createFramer,
  createResampler,
  floatToPcm16,
  level,
} from "./pcm"

test("same rate passes samples through", () => {
  const resample = createResampler(24000, 24000)
  const first = resample(Float32Array.from([0, 0.5, 1]))
  const second = resample(Float32Array.from([0.5, 0]))
  // Each chunk keeps its last sample back to join it to the next one.
  expect([...first, ...second]).toEqual([0, 0.5, 1, 0.5])
})

test("48 kHz to 24 kHz keeps every other sample across chunks", () => {
  const resample = createResampler(48000, 24000)
  const out = [
    ...resample(Float32Array.from([0, 1, 2, 3, 4])),
    ...resample(Float32Array.from([5, 6, 7, 8])),
  ]
  expect(out).toEqual([0, 2, 4, 6])
})

test("44.1 kHz to 24 kHz gives the right number of samples", () => {
  const resample = createResampler(44100, 24000)
  let total = 0
  for (let i = 0; i < 100; i++) total += resample(new Float32Array(441)).length
  // One second in, one second out (give or take the held-back sample).
  expect(Math.abs(total - 24000)).toBeLessThanOrEqual(1)
})

test("floats become clipped 16-bit samples", () => {
  expect([...floatToPcm16(Float32Array.from([0, 1, -1, 2, -2]))]).toEqual([
    0, 32767, -32768, 32767, -32768,
  ])
})

test("the framer hands back whole frames and keeps the rest", () => {
  const frame = createFramer(4)
  expect(frame(Int16Array.from([1, 2, 3]))).toEqual([])
  expect(frame(Int16Array.from([4, 5, 6, 7, 8, 9]))).toEqual([
    Int16Array.from([1, 2, 3, 4]),
    Int16Array.from([5, 6, 7, 8]),
  ])
  expect(frame(Int16Array.from([10, 11, 12]))).toEqual([
    Int16Array.from([9, 10, 11, 12]),
  ])
})

test("base64 PCM becomes floats", () => {
  // Little-endian 0, 16384 (0.5), -32768 (-1).
  const bytes = Uint8Array.from([0, 0, 0, 0x40, 0, 0x80])
  const base64 = btoa(String.fromCharCode(...bytes))
  expect([...base64Pcm16ToFloat(base64)]).toEqual([0, 0.5, -1])
})

test("level is 0 for silence and capped at 1", () => {
  expect(level(new Float32Array(10))).toBe(0)
  expect(level(new Float32Array(10).fill(1))).toBe(1)
})
