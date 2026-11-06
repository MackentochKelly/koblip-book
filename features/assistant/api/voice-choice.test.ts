// @vitest-environment node
import { expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/account-voices", () => ({
  getAccountVoices: vi.fn(),
  getOwnerVoiceId: vi.fn(),
}))
const { getAccountVoices, getOwnerVoiceId } =
  await import("@/lib/account-voices")
const { getVoiceChoice } = await import("./voice-choice")

const voice = (voiceId: string, previews: Record<string, string>) => ({
  voiceId,
  name: voiceId,
  previewUrl: `https://x/${voiceId}.mp3`,
  labels: { gender: "female" },
  languages: Object.keys(previews),
  previews,
})

test("lists the voices with a page-language preview, and the owner's own", async () => {
  vi.mocked(getAccountVoices).mockResolvedValue([
    voice("en1", { en: "https://x/en1-en.mp3" }),
    voice("both", { en: "https://x/both-en.mp3", es: "https://x/both-es.mp3" }),
    voice("pt1", { pt: "https://x/pt1-pt.mp3" }),
    voice("fr1", { fr: "https://x/fr1-fr.mp3" }),
    voice("it1", { it: "https://x/it1-it.mp3" }),
    voice("mine", { de: "https://x/mine-de.mp3" }),
  ])
  vi.mocked(getOwnerVoiceId).mockResolvedValue("mine")
  const choice = await getVoiceChoice("u1")
  expect(choice.chosen).toBe("mine")
  expect(choice.voices?.map((item) => item.voiceId)).toEqual([
    "en1",
    "both",
    "pt1",
    "fr1",
    "mine",
  ])
  // Only what the picker shows crosses to the browser.
  expect(choice.voices?.[1]).toEqual({
    voiceId: "both",
    name: "both",
    labels: { gender: "female" },
    previews: { en: "https://x/both-en.mp3", es: "https://x/both-es.mp3" },
  })
})

test("no list when ElevenLabs can't be reached", async () => {
  vi.mocked(getAccountVoices).mockResolvedValue(null)
  vi.mocked(getOwnerVoiceId).mockResolvedValue(null)
  expect(await getVoiceChoice("u1")).toEqual({
    voices: null,
    chosen: null,
  })
})
