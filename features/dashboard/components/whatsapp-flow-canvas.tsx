"use client"

import { FlowCanvas } from "@/components/flow-canvas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  BellIcon,
  CalendarIcon,
  LinkIcon,
  MessageCircleIcon,
  TagIcon,
  UsersIcon,
  WhatsAppIcon,
} from "@/components/ui/icons"
import { useOwnerMessages } from "../i18n/provider"
import type { Automation, AutomationAction, AutomationLanguage } from "../types/automations"
import { flowGraph, type FlowIcon } from "../utils/flow-graph"

const ICONS: Record<FlowIcon, React.ReactNode> = {
  trigger: <MessageCircleIcon className="text-muted-foreground" />,
  whatsapp: <WhatsAppIcon />,
  bookingLink: <CalendarIcon className="text-muted-foreground" />,
  servicesList: <TagIcon className="text-muted-foreground" />,
  link: <LinkIcon className="text-muted-foreground" />,
  bell: <BellIcon className="text-muted-foreground" />,
  handoff: <UsersIcon className="text-muted-foreground" />,
}

const ACTIONS: AutomationAction["type"][] = ["bookingLink", "servicesList", "handoff"]

// A flow as Koblip Sales draws one: its steps on the side, the flow on a
// canvas. It shows what the engine really runs; any step opens the editor,
// and a button the flow doesn't use yet opens it with that button added.
export function WhatsappFlowCanvas({
  automation,
  businessName,
  language,
  maxButtons,
  onOpen,
}: {
  automation: Automation
  businessName: string
  language: AutomationLanguage
  maxButtons: number
  onOpen: (adding?: AutomationAction["type"]) => void
}) {
  const t = useOwnerMessages().whatsapp.flows
  const c = t.canvas
  const { steps, links } = flowGraph(automation, language, businessName, {
    trigger: t.triggers[automation.trigger],
    steps: c.steps,
    bookingLink: t.actions.bookingLink,
    serviceLink: c.serviceLink,
    notify: t.actions.handoff,
    actions: t.actions,
  })
  const full = automation.buttons.length >= maxButtons
  const inUse = (action: AutomationAction["type"]) =>
    automation.buttons.some((button) => button.action.type === action)

  return (
    <div className="flex h-[70svh] min-h-96 overflow-hidden rounded-4xl bg-card ring-1 ring-border">
      {/* Computers only: a phone adds buttons from the editor. */}
      <div className="hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r p-3 md:flex">
        <PaletteGroup title={c.groups.start}>
          <PaletteStep icon={ICONS.trigger} title={c.steps.customerWrites} used={c.inUse} onClick={() => onOpen()} />
        </PaletteGroup>
        <PaletteGroup title={c.groups.messages}>
          <PaletteStep icon={ICONS.whatsapp} title={c.steps.sendMessage} used={c.inUse} onClick={() => onOpen()} />
        </PaletteGroup>
        <PaletteGroup title={c.groups.buttons}>
          {ACTIONS.map((action) => (
            <PaletteStep
              key={action}
              icon={ICONS[action]}
              title={c.palette[action]}
              used={inUse(action) ? c.inUse : undefined}
              disabled={!inUse(action) && full}
              onClick={() => onOpen(inUse(action) ? undefined : action)}
            />
          ))}
        </PaletteGroup>
      </div>
      <div className="min-w-0 flex-1">
        <FlowCanvas
          label={t.stepsLabel(t.names[automation.trigger])}
          steps={steps.map((step) => ({ ...step, icon: ICONS[step.icon], kind: c.kinds[step.kind] }))}
          links={links}
          labels={c.zoom}
          onOpenStep={() => onOpen()}
        />
      </div>
    </div>
  )
}

function PaletteGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 text-xs text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

function PaletteStep({
  icon,
  title,
  used,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  used?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button variant="ghost" className="h-auto min-h-9 justify-start py-2 text-left whitespace-normal" disabled={disabled} onClick={onClick}>
      {icon}
      <span className="min-w-0 flex-1">{title}</span>
      {used && <Badge variant="secondary">{used}</Badge>}
    </Button>
  )
}
