import { type FlowStep, FlowSteps } from "@/components/flow-steps"
import {
  CalendarIcon,
  MessageCircleIcon,
  TagIcon,
  UsersIcon,
  WhatsAppIcon,
} from "@/components/ui/icons"

type ActionType = "bookingLink" | "servicesList" | "handoff"

// What each button's action looks like as a step.
const ACTION_ICONS: Record<ActionType, React.ReactNode> = {
  bookingLink: <CalendarIcon />,
  servicesList: <TagIcon />,
  handoff: <UsersIcon />,
}

export type AutomationStepsLabels = {
  // The list's name for screen readers, e.g. "Welcome steps".
  label: string
  when: string
  send: string
  button: string
  // What starts it, e.g. "A customer writes for the first time".
  trigger: string
  actions: Record<ActionType, string>
}

// A WhatsApp automation top to bottom, in one language: what starts it,
// what it sends, each button and what it does. The owner's Flows and the
// admin's business page both show it.
export function AutomationSteps({
  body,
  buttons,
  labels: t,
}: {
  // The text as the customer reads it.
  body: string
  buttons: { id: string; label: string; action: ActionType }[]
  labels: AutomationStepsLabels
}) {
  const steps: FlowStep[] = [
    {
      id: "trigger",
      icon: <MessageCircleIcon />,
      tone: "info",
      kicker: t.when,
      title: t.trigger,
    },
    {
      id: "message",
      icon: <WhatsAppIcon />,
      tone: "success",
      kicker: t.send,
      title: body,
      branches: buttons.map((button) => ({
        id: button.id,
        icon: ACTION_ICONS[button.action],
        kicker: t.button,
        title: button.label,
        description: t.actions[button.action],
      })),
    },
  ]
  return <FlowSteps label={t.label} steps={steps} />
}
