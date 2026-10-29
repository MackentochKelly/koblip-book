import "server-only"

import { DEMO_RULES } from "@/lib/demo-rules"

// In-memory per-address sliding window for new demo copies, like the
// assistant's limit. Resets on deploy; the copies themselves are capped by
// the purge.
const opened = new Map<string, number[]>()
const WINDOW_MS = 3_600_000

// True when this address may open a new copy (and records it).
export function mayOpenNewDemo(address: string, now = Date.now()): boolean {
  const cutoff = now - WINDOW_MS
  const recent = (opened.get(address) ?? []).filter((t) => t > cutoff)
  if (recent.length >= DEMO_RULES.newPerAddressPerHour) {
    opened.set(address, recent)
    return false
  }
  recent.push(now)
  opened.set(address, recent)
  return true
}

// Only for tests.
export function resetNewDemoLimitForTests(): void {
  opened.clear()
}
