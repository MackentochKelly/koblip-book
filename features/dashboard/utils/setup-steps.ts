import type { ChatConnection } from "../types/chat-connection"
import type { NotificationMessage, SetupStep } from "../types/notifications"
import { isCustomerMessage } from "./customer-messages"

export const SETUP_STEPS: readonly SetupStep[] = [
  "connected",
  "reviewed",
  "submitted",
  "approved",
  "live",
]

// Where the business stands on the way to sending (decision D23 in
// docs/plans/whatsapp-notifications.md), from the turned-on messages in
// both languages: connected with a WhatsApp number; reviewed, each one the
// owner's own wording or already submitted; submitted, none a draft;
// approved by Meta; live, approved with a customer message on.
export function setupSteps(
  connection: ChatConnection | null,
  messages: NotificationMessage[]
): Record<SetupStep, boolean> {
  const texts = messages
    .filter((item) => item.on)
    .flatMap((item) => Object.values(item.texts))
  const connected =
    !!connection && !connection.needsReconnect && connection.messages !== "noNumber"
  const reviewed =
    connected && texts.every((text) => !text.isDefault || text.review !== "draft")
  const submitted = reviewed && texts.every((text) => text.review !== "draft")
  const approved = submitted && texts.every((text) => text.review === "approved")
  const live = approved && messages.some((item) => item.on && isCustomerMessage(item.message))
  return { connected, reviewed, submitted, approved, live }
}
