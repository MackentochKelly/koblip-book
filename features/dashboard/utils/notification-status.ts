import type { ChatConnection } from "../types/chat-connection"
import type { NotificationMessage, Sender, SetupStep } from "../types/notifications"
import { isCustomerMessage } from "./customer-messages"
import { setupSteps } from "./setup-steps"

// The one state the Overview's status card shows (D36).
export type OverviewState = "live" | "action" | "waiting"

// The one thing the owner can do next, the card's main button; null when
// there is nothing to do but wait or send.
export type NextStep =
  | "connect"
  | "reconnect"
  | "addNumber"
  | "fix"
  | "review"
  | "submit"
  | "turnOn"

// Where the business's notifications stand, from what the page already
// reads: the number that sends, its own Koblip Chat connection and the
// messages (their Meta review is Koblip's set's on Koblip's number, D26).
// The setup steps are the own number's (D23); without one, a business on
// Koblip's number only has to keep a customer message on.
export function notificationStatus(
  sender: Sender | null,
  connection: ChatConnection | null,
  messages: NotificationMessage[]
): { state: OverviewState; next: NextStep | null; steps: Record<SetupStep, boolean> } {
  const steps = setupSteps(connection, messages)
  const on = messages.filter((item) => item.on)
  const texts = on.flatMap((item) => Object.values(item.texts))
  const customerOn = on.some((item) => isCustomerMessage(item.message))
  // On Koblip's number with no workspace of its own, its own number's steps
  // are optional ("Use your own number"), not a next step.
  const next =
    connection || !sender
      ? nextStep(connection, steps, customerOn, texts.some((text) => text.review === "rejected"))
      : customerOn
        ? null
        : "turnOn"
  if (next) return { state: "action", next, steps }
  const approved = connection ? steps.approved : texts.every((text) => text.review === "approved")
  return { state: approved && sender ? "live" : "waiting", next, steps }
}

function nextStep(
  connection: ChatConnection | null,
  steps: Record<SetupStep, boolean>,
  customerOn: boolean,
  rejected: boolean
): NextStep | null {
  if (!connection) return "connect"
  if (connection.needsReconnect) return "reconnect"
  if (!steps.connected) return "addNumber"
  if (rejected) return "fix"
  if (!steps.reviewed) return "review"
  if (!steps.submitted) return "submit"
  if (!customerOn) return "turnOn"
  return null
}
