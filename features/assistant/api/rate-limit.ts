import "server-only"

// In-memory per-owner sliding window. Resets on deploy; good enough for now.
const hits = new Map<string, number[]>()
const WINDOW_MS = 60_000

// True when the request may proceed (and records it). False when over the limit.
export function checkAssistantRateLimit(
  ownerId: string,
  maxPerMinute: number,
  now = Date.now()
): boolean {
  const cutoff = now - WINDOW_MS
  const recent = (hits.get(ownerId) ?? []).filter((t) => t > cutoff)
  if (recent.length >= maxPerMinute) {
    hits.set(ownerId, recent)
    return false
  }
  recent.push(now)
  hits.set(ownerId, recent)
  return true
}

// Only for tests.
export function resetAssistantRateLimitForTests(): void {
  hits.clear()
}
