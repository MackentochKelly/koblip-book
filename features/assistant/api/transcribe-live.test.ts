// @vitest-environment node
// Opt-in live test: real Meta call with a synthesized tone (no fixture,
// no microphone, no database, no auth). Runs only with RUN_LIVE_EVALS=1,
// so normal `vitest run` skips it.
import { describe, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const LIVE = process.env.RUN_LIVE_EVALS === "1"
// Needs the real key in the environment, e.g.
// `set -a; source .env.local; set +a` first. Never print it.
const KEY = process.env.MODEL_API_KEY ?? ""

const { transcribeVoice } = await import("./transcribe")

// One second of a 440 Hz tone: valid 16 kHz mono 16-bit WAV. A tone
// carries no speech, so Meta should hear silence; either way the result
// must be well-formed and must not be an auth failure.
function tone(): Uint8Array {
  const rate = 16000
  const samples = rate
  const buf = new ArrayBuffer(44 + samples * 2)
  const v = new DataView(buf)
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) v.setUint8(offset + i, s.charCodeAt(i))
  }
  ascii(0, "RIFF")
  v.setUint32(4, 36 + samples * 2, true)
  ascii(8, "WAVE")
  ascii(12, "fmt ")
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  ascii(36, "data")
  v.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i += 1) {
    v.setInt16(
      44 + i * 2,
      Math.floor(Math.sin((2 * Math.PI * 440 * i) / rate) * 16000),
      true
    )
  }
  return new Uint8Array(buf)
}

describe.skipIf(!LIVE || KEY === "")("live transcribe (RUN_LIVE_EVALS=1)", () => {
  test("tone returns text or empty_audio, never unavailable", async () => {
    const result = await transcribeVoice(tone(), "en")
    console.log(`live transcribe result: ${JSON.stringify(result)}`)
    if ("text" in result) {
      expect(typeof result.text).toBe("string")
    } else {
      // Valid audio with no speech: Meta heard nothing.
      expect(result.code).toBe("empty_audio")
    }
  }, 120_000)
})
