// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/meta-ai", () => ({
  META_VOICE_MODEL: "muse-voice-transcribe-1.0",
  getMetaAiClient: vi.fn(),
}))

const { getMetaAiClient } = await import("@/lib/meta-ai")
const { transcribeVoice } = await import("./transcribe")
const { ASSISTANT_RULES } = await import("@/lib/assistant-rules")

// Minimal RIFF/WAVE builder: 44-byte header plus zeroed samples.
function wav({
  rate = 16000,
  channels = 1,
  bits = 16,
  seconds = 1,
  format = 1,
}: {
  rate?: number
  channels?: number
  bits?: number
  seconds?: number
  format?: number
} = {}): Uint8Array {
  const dataLen = Math.floor(seconds * rate * channels * (bits / 8))
  const buf = new ArrayBuffer(44 + dataLen)
  const v = new DataView(buf)
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) v.setUint8(offset + i, s.charCodeAt(i))
  }
  ascii(0, "RIFF")
  v.setUint32(4, 36 + dataLen, true)
  ascii(8, "WAVE")
  ascii(12, "fmt ")
  v.setUint32(16, 16, true)
  v.setUint16(20, format, true)
  v.setUint16(22, channels, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, Math.floor((rate * channels * bits) / 8), true)
  v.setUint16(32, Math.floor((channels * bits) / 8), true)
  v.setUint16(34, bits, true)
  ascii(36, "data")
  v.setUint32(40, dataLen, true)
  return new Uint8Array(buf)
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.mocked(getMetaAiClient).mockReturnValue({
    apiKey: "test-key",
    baseURL: "https://api.meta.ai/v1",
  } as never)
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(console, "error").mockImplementation(() => {})
})

function metaOk(transcript: string) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ transcript }), { status: 200 })
  )
}

test("missing key yields unavailable without calling Meta", async () => {
  vi.mocked(getMetaAiClient).mockReturnValue(null)
  expect(await transcribeVoice(wav(), "en")).toEqual({
    code: "unavailable",
  })
  expect(fetchMock).not.toHaveBeenCalled()
})

test("non-WAV bytes yield bad_request without calling Meta", async () => {
  expect(
    await transcribeVoice(new Uint8Array([1, 2, 3, 4]), "en")
  ).toEqual({ code: "bad_request" })
  expect(fetchMock).not.toHaveBeenCalled()
})

test("wrong WAV shape yields bad_request", async () => {
  for (const bad of [
    wav({ channels: 2 }),
    wav({ bits: 8 }),
    wav({ rate: 44100 }),
    wav({ format: 3 }),
  ]) {
    expect(await transcribeVoice(bad, "en")).toEqual({
      code: "bad_request",
    })
  }
  expect(fetchMock).not.toHaveBeenCalled()
})

test("24 kHz mono is accepted", async () => {
  metaOk("hola")
  const result = await transcribeVoice(wav({ rate: 24000 }), "es")
  expect(result).toEqual({ text: "hola" })
})

test("audio past the limit yields too_long without calling Meta", async () => {
  const over = wav({ seconds: ASSISTANT_RULES.maxTranscribeSeconds + 1 })
  expect(over.length).toBeLessThan(ASSISTANT_RULES.maxTranscribeBytes)
  expect(await transcribeVoice(over, "en")).toEqual({ code: "too_long" })
  expect(fetchMock).not.toHaveBeenCalled()
})

test("zero samples yield empty_audio without calling Meta", async () => {
  expect(await transcribeVoice(wav({ seconds: 0 }), "en")).toEqual({
    code: "empty_audio",
  })
  expect(fetchMock).not.toHaveBeenCalled()
})

test("blank transcript yields empty_audio", async () => {
  metaOk("   ")
  expect(await transcribeVoice(wav(), "en")).toEqual({
    code: "empty_audio",
  })
})

test("Meta errors map to short codes, never provider text", async () => {
  fetchMock.mockResolvedValue(new Response("bad wav", { status: 400 }))
  expect(await transcribeVoice(wav(), "en")).toEqual({
    code: "bad_request",
  })
  fetchMock.mockResolvedValue(new Response("too big", { status: 413 }))
  expect(await transcribeVoice(wav(), "en")).toEqual({ code: "too_long" })
  fetchMock.mockResolvedValue(new Response("busy", { status: 429 }))
  expect(await transcribeVoice(wav(), "en")).toEqual({
    code: "unavailable",
  })
  fetchMock.mockResolvedValue(new Response("boom", { status: 500 }))
  expect(await transcribeVoice(wav(), "en")).toEqual({
    code: "unavailable",
  })
  fetchMock.mockRejectedValue(new Error("network down"))
  expect(await transcribeVoice(wav(), "en")).toEqual({
    code: "unavailable",
  })
})

test("request hits the ASR endpoint with the cookie language as hint", async () => {
  metaOk("what bookings do I have")
  await transcribeVoice(wav(), "en")
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(url).toBe("https://api.meta.ai/v1/asr/transcribe")
  const headers = new Headers(init.headers)
  expect(headers.get("Authorization")).toBe("Bearer test-key")
  expect(headers.get("Accept")).toBe("application/json")
  const form = init.body as FormData
  const settings = JSON.parse(await (form.get("request") as Blob).text())
  expect(settings).toMatchObject({
    model: "muse-voice-transcribe-1.0",
    audioEncoding: "WAV",
    mode: "PUSH_TO_TALK",
    languageBias: ["English"],
  })
  const audio = form.get("audio") as File
  expect(audio.type).toBe("audio/wav")

  metaOk("¿qué reservas tengo?")
  await transcribeVoice(wav(), "es")
  const init2 = fetchMock.mock.calls[1]?.[1] as RequestInit
  const form2 = init2.body as FormData
  const settings2 = JSON.parse(await (form2.get("request") as File).text())
  expect(settings2.languageBias).toEqual(["Spanish"])
})
