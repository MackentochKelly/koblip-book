import { describe, expect, it } from "vitest"

import { encodeWav } from "./wav"

describe("encodeWav", () => {
  it("writes a mono 16-bit PCM header and the samples", async () => {
    const blob = encodeWav(new Float32Array([0, 1, -1, 2]), 16000)
    const view = new DataView(await blob.arrayBuffer())
    const tag = (at: number) =>
      String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(at + i)))

    expect(blob.type).toBe("audio/wav")
    expect(blob.size).toBe(44 + 4 * 2)
    expect(tag(0)).toBe("RIFF")
    expect(tag(8)).toBe("WAVE")
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(8)
    expect(view.getInt16(44, true)).toBe(0)
    expect(view.getInt16(46, true)).toBe(0x7fff)
    expect(view.getInt16(48, true)).toBe(-0x8000)
    expect(view.getInt16(50, true)).toBe(0x7fff) // clamped
  })
})
