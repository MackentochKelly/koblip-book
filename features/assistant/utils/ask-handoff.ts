// What the owner started somewhere else (the Ask card on Home) for the
// assistant page to carry on when it opens, as a new chat: a question to
// send, or talking live. Kept for this browser tab only and never in the
// address, since a question can name customers.
export type HandOff = { kind: "ask"; text: string } | { kind: "live" }

const keyFor = (businessId: string) => `assistant-handoff:${businessId}`

export function handOff(businessId: string, value: HandOff): void {
  try {
    sessionStorage.setItem(keyFor(businessId), JSON.stringify(value))
  } catch {
    // Storage is off: the assistant just opens as it was.
  }
}

// Done with it, so it is used only once.
export function clearHandOff(businessId: string): void {
  try {
    sessionStorage.removeItem(keyFor(businessId))
  } catch {
    // Storage is off: nothing was kept.
  }
}

// The waiting hand-off, left in place until clearHandOff: a page mounted
// twice while it loads (React's development check) reads the same one.
export function readHandOff(businessId: string): HandOff | null {
  try {
    const saved = sessionStorage.getItem(keyFor(businessId))
    if (!saved) return null
    const value: unknown = JSON.parse(saved)
    if (typeof value !== "object" || value === null) return null
    if ("kind" in value && value.kind === "live") return { kind: "live" }
    if (
      "kind" in value &&
      value.kind === "ask" &&
      "text" in value &&
      typeof value.text === "string" &&
      value.text.trim() !== ""
    ) {
      return { kind: "ask", text: value.text }
    }
    return null
  } catch {
    return null
  }
}
