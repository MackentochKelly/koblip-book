// @vitest-environment node
import { expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/account-voices", () => ({
  getAccountVoices: vi.fn(),
  getOwnerVoiceId: vi.fn(),
}))
const { getAccountVoices, getOwnerVoiceId } = await import(
  "@/lib/account-voices"
)
const { getVoiceChoice } = await import("./voice-choice")

const voice = (voiceId: string, languages: string[]) => ({
  voiceId,
  name: voiceId,
  previewUrl: `https://x/${voiceId}.mp3`,
  labels: { gender: "female" },
  languages,
})

test("lists the voices that speak the owner's language, and their own", async () => {
  vi.mocked(getAccountVoices).mockResolvedValue([
    voice("en1", ["en"]),
    voice("both", ["en", "es"]),
    voice("es1", ["es"]),
  ])
  vi.mocked(getOwnerVoiceId).mockResolvedValue("en1")
  const choice = await getVoiceChoice("u1", "es")
  expect(choice.chosen).toBe("en1")
  expect(choice.voices?.map((item) => item.voiceId)).toEqual([
    "en1",
    "both",
    "es1",
  ])
  // Only what the picker shows crosses to the browser.
  expect(choice.voices?.[0]).toEqual({
    voiceId: "en1",
    name: "en1",
    previewUrl: "https://x/en1.mp3",
    labels: { gender: "female" },
  })
})

test("no list when ElevenLabs can't be reached", async () => {
  vi.mocked(getAccountVoices).mockResolvedValue(null)
  vi.mocked(getOwnerVoiceId).mockResolvedValue(null)
  expect(await getVoiceChoice("u1", "en")).toEqual({
    voices: null,
    chosen: null,
  })
})
