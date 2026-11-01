// Timing for the setup screens that fill in row by row
// (components/step-reveal.tsx).

export const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

// The work's result, but never sooner than `ms`: a row that is already
// ready still shows as working for a moment, so rows finish one by one
// instead of all at once.
export async function atLeast<T>(work: Promise<T>, ms: number): Promise<T> {
  const [result] = await Promise.all([work, pause(ms)])
  return result
}
