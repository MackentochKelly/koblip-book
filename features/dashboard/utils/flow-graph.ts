import type { Automation, AutomationAction, AutomationLanguage } from "../types/automations"

export type FlowIcon = "trigger" | "whatsapp" | AutomationAction["type"] | "link" | "bell"

export type FlowGraphStep = {
  id: string
  position: { x: number; y: number }
  icon: FlowIcon
  title: string
  summary: string
  kind: "trigger" | "action"
  start?: boolean
  outputs?: { id: string; label: string }[]
  next?: boolean
}

export type FlowGraphLabels = {
  trigger: string
  steps: {
    customerWrites: string
    sendMessage: string
    bookingLink: string
    servicesList: string
    serviceLink: string
    notify: string
    reply: string
  }
  bookingLink: string
  serviceLink: string
  notify: string
  // A button with no words yet reads as what it does.
  actions: Record<AutomationAction["type"], string>
}

const COLUMN = 340
const ROW = 200

// The steps a flow really runs, as automation-engine.ts runs them: the
// trigger, the message and, for each button, what its tap does.
export function flowGraph(
  automation: Pick<Automation, "wording" | "buttons">,
  language: AutomationLanguage,
  businessName: string,
  t: FlowGraphLabels
) {
  const words = automation.wording[language]
  const fill = (text: string) => text.replaceAll("{business}", businessName)
  const middle = ((automation.buttons.length - 1) * ROW) / 2
  const steps: FlowGraphStep[] = [
    {
      id: "trigger",
      position: { x: 0, y: middle },
      icon: "trigger",
      title: t.steps.customerWrites,
      summary: t.trigger,
      kind: "trigger",
      start: true,
      next: true,
    },
    {
      id: "message",
      position: { x: COLUMN, y: middle },
      icon: "whatsapp",
      title: t.steps.sendMessage,
      summary: fill(words.body),
      kind: "action",
      outputs: automation.buttons.map((button) => ({
        id: button.id,
        label: button.label[language] || t.actions[button.action.type],
      })),
    },
  ]
  const links: { from: string; output?: string; to: string }[] = [{ from: "trigger", to: "message" }]

  automation.buttons.forEach((button, row) => {
    const place = (column: number) => ({ x: COLUMN * column, y: ROW * row })
    const first = `${button.id}:1`
    const second = `${button.id}:2`
    links.push({ from: "message", output: button.id, to: first })
    if (button.action.type === "bookingLink") {
      steps.push({
        id: first, position: place(2), icon: "bookingLink", title: t.steps.bookingLink,
        summary: t.bookingLink, kind: "action",
      })
    } else if (button.action.type === "servicesList") {
      steps.push(
        {
          id: first, position: place(2), icon: "servicesList", title: t.steps.servicesList,
          summary: fill(words.servicesIntro), kind: "action", next: true,
        },
        {
          id: second, position: place(3), icon: "link", title: t.steps.serviceLink,
          summary: t.serviceLink, kind: "action",
        }
      )
      links.push({ from: first, to: second })
    } else {
      steps.push(
        {
          id: first, position: place(2), icon: "bell", title: t.steps.notify,
          summary: t.notify, kind: "action", next: true,
        },
        {
          id: second, position: place(3), icon: "handoff", title: t.steps.reply,
          summary: fill(words.handoffReply), kind: "action",
        }
      )
      links.push({ from: first, to: second })
    }
  })
  return { steps, links }
}
