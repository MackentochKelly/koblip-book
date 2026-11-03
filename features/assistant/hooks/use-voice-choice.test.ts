import { renderHook } from "@testing-library/react"
import { expect, test, vi } from "vitest"

vi.mock("../api/voice-actions", () => ({ saveOwnerVoice: vi.fn() }))
const { useVoiceChoice } = await import("./use-voice-choice")

const voices = [
  { voiceId: "both", name: "Hope", labels: {}, previews: { en: "e", es: "s" } },
  { voiceId: "es", name: "Valeria", labels: {}, previews: { es: "s" } },
]

test("a talk starts only with a chosen voice that speaks its language", () => {
  const spanishOnly = renderHook(() => useVoiceChoice({ voices, chosen: "es" }))
    .result.current
  expect(spanishOnly.speaks("es")).toBe(true)
  expect(spanishOnly.speaks("en")).toBe(false)
  const both = renderHook(() => useVoiceChoice({ voices, chosen: "both" }))
    .result.current
  expect(both.speaks("en")).toBe(true)
  const none = renderHook(() => useVoiceChoice({ voices, chosen: null })).result
    .current
  expect(none.speaks("en")).toBe(false)
})
