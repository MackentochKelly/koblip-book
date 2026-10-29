// Raw audio for live voice. Meta hears 16-bit little-endian mono PCM in
// ~80 ms frames; ElevenLabs speaks the same format back as base64.
// (https://dev.meta.ai/docs/api-reference/voice/realtime,
// https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket)

// Turns the microphone's rate (often 44.1 or 48 kHz) into another, chunk
// after chunk, with straight-line steps between samples. It keeps its place
// between chunks so the joins don't click.
export function createResampler(fromRate: number, toRate: number) {
  const step = fromRate / toRate
  // Where the next output sample sits, counted from the start of `chunk`
  // (it can be just before it: -1 is the last sample of the chunk before).
  let position = 0
  let previous = 0
  return (chunk: Float32Array): Float32Array => {
    const out: number[] = []
    const at = (index: number) => (index < 0 ? previous : chunk[index])
    while (position < chunk.length - 1) {
      const left = Math.floor(position)
      const weight = position - left
      out.push(at(left) * (1 - weight) + at(left + 1) * weight)
      position += step
    }
    if (chunk.length > 0) previous = chunk[chunk.length - 1]
    position -= chunk.length
    return Float32Array.from(out)
  }
}

// -1..1 floats to 16-bit samples, clipped.
export function floatToPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

// Collects samples and hands back whole frames of `frameSamples` each.
export function createFramer(frameSamples: number) {
  let pending = new Int16Array(0)
  return (chunk: Int16Array): Int16Array[] => {
    const all = new Int16Array(pending.length + chunk.length)
    all.set(pending)
    all.set(chunk, pending.length)
    const frames: Int16Array[] = []
    let start = 0
    while (all.length - start >= frameSamples) {
      frames.push(all.slice(start, start + frameSamples))
      start += frameSamples
    }
    pending = all.slice(start)
    return frames
  }
}

// ElevenLabs' base64 audio chunk to -1..1 floats for an AudioBuffer.
export function base64Pcm16ToFloat(base64: string): Float32Array<ArrayBuffer> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  const out = new Float32Array(Math.floor(bytes.length / 2))
  for (let i = 0; i < out.length; i++) {
    out[i] = view.getInt16(i * 2, true) / 0x8000
  }
  return out
}

// Loudness 0..1 of a slice of samples (root mean square, scaled so normal
// speech fills most of the range). Feeds the orb.
export function level(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.min(1, Math.sqrt(sum / samples.length) * 4)
}
