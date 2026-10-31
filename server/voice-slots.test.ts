// @vitest-environment node
import { expect, test } from "vitest"

const { createVoiceSlots } = await import("./voice-slots.mjs")

test("an owner gets at most `max` open sessions; a close frees one", () => {
  const slots = createVoiceSlots()
  const first = slots.take("u1", 2)
  const second = slots.take("u1", 2)
  expect(first).toBeTypeOf("function")
  expect(second).toBeTypeOf("function")
  expect(slots.take("u1", 2)).toBeNull()
  // Other owners are not affected.
  expect(slots.take("u2", 2)).toBeTypeOf("function")
  first!()
  expect(slots.count("u1")).toBe(1)
  expect(slots.take("u1", 2)).toBeTypeOf("function")
})

test("releasing twice frees only one slot", () => {
  const slots = createVoiceSlots()
  const release = slots.take("u1", 2)!
  slots.take("u1", 2)
  release()
  release()
  expect(slots.count("u1")).toBe(1)
})
