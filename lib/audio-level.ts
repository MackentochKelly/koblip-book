// Loudness 0..1 of a slice of samples (root mean square, scaled so normal
// speech fills most of the range). Feeds the voice globe.
export function audioLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.min(1, Math.sqrt(sum / samples.length) * 4)
}
