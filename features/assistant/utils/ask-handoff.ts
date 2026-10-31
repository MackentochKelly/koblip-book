// A question asked somewhere else (the Ask card on Home) for the assistant
// page to send when it opens, as a new chat. Kept for this browser tab only
// and never in the address, since it can name customers.
const keyFor = (businessId: string) => `assistant-ask:${businessId}`

export function handOffQuestion(businessId: string, text: string): void {
  try {
    sessionStorage.setItem(keyFor(businessId), text)
  } catch {
    // Storage is off: the assistant just opens empty.
  }
}

// The waiting question, taken so it is sent only once.
export function takeHandedOffQuestion(businessId: string): string | null {
  try {
    const text = sessionStorage.getItem(keyFor(businessId))
    sessionStorage.removeItem(keyFor(businessId))
    return text?.trim() ? text : null
  } catch {
    return null
  }
}
