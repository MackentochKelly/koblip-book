// Only routing data is retained from a verified Chat callback. Text and media
// are deliberately excluded from automation processing and diagnostic logs.
export type AutomationEvent = {
  type: "inbound" | "outbound"
  eventId: string
  workspaceId: string
  phoneNumberId: string | null
  customerPhone: string
  at: string
  recordId: string | null
  messageId: string | null
  replyToMessageId: string | null
  payload: string | null
}

export function automationEvent(value: unknown): AutomationEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (input.type !== "inbound" && input.type !== "outbound") return null
  for (const key of ["eventId", "workspaceId", "occurredAt"]) {
    if (typeof input[key] !== "string" || !(input[key] as string).trim()) return null
  }
  if (input.type === "inbound" && (typeof input.senderId !== "string" || !input.senderId)) return null
  const phone = input.type === "inbound" ? input.fromPhone : input.toPhone
  if (typeof phone !== "string" || !phone.replace(/\D/g, "")) return null
  const at = new Date(input.occurredAt as string)
  if (Number.isNaN(at.getTime())) return null
  const string = (key: string) => typeof input[key] === "string" && input[key] ? input[key] as string : null
  const button = input.button && typeof input.button === "object" ? input.button as Record<string, unknown> : null
  return {
    type: input.type,
    eventId: input.eventId as string,
    workspaceId: input.workspaceId as string,
    phoneNumberId: input.type === "inbound" ? input.senderId as string : string("senderId"),
    customerPhone: phone.replace(/\D/g, ""),
    at: at.toISOString(),
    recordId: string("recordId"),
    messageId: string("messageId"),
    replyToMessageId: string("replyToMessageId"),
    payload: typeof button?.payload === "string" ? button.payload : null,
  }
}
