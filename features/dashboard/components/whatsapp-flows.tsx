"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { type FlowStep, FlowSteps } from "@/components/flow-steps"
import { Button } from "@/components/ui/button"
import {
  CalendarIcon,
  TagIcon,
  MessageCircleIcon,
  UsersIcon,
  WhatsAppIcon,
} from "@/components/ui/icons"
import { SwitchCard } from "@/components/switch-card"
import { ItemGroup } from "@/components/ui/item"
import { setAutomationOn } from "../api/automation-actions"
import { useOwnerMessages } from "../i18n/provider"
import type {
  Automation,
  AutomationAction,
  AutomationLanguage,
} from "../types/automations"
import { AutomationEditor, type AutomationLimits } from "./automation-editor"

// What each button's action looks like as a step.
const ACTION_ICONS: Record<AutomationAction["type"], React.ReactNode> = {
  bookingLink: <CalendarIcon />,
  servicesList: <TagIcon />,
  handoff: <UsersIcon />,
}

// Flows: each automation as a card with its switch, like Messages, and its
// steps under it; the card opens its editor (D11). Flows answer only on the
// business's own number (D2).
export function WhatsappFlows({
  businessId,
  businessName,
  automations,
  ownNumber,
  limits,
}: {
  businessId: string
  businessName: string
  automations: Automation[]
  ownNumber: boolean
  limits: AutomationLimits
}) {
  // The open flow is read from `automations`, so a refresh shows its news.
  const [openId, setOpenId] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const m = useOwnerMessages()
  const t = m.whatsapp
  const open = automations.find((item) => item.id === openId)
  // The owner reads the words in their own language.
  const language: AutomationLanguage = m.locale.startsWith("es") ? "es" : "en"

  return (
    <div className="flex flex-col gap-3">
      {!ownNumber && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t.flows.ownNumberOnly}</p>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/dashboard/${businessId}/integrations`} />}
          >
            {t.useOwnNumber}
          </Button>
        </div>
      )}
      {/* Each flow: its card with the switch, then its steps. */}
      {automations.map((automation) => (
        <div key={automation.id} className="flex flex-col gap-3">
          <ItemGroup>
            <FlowRow
              businessId={businessId}
              automation={automation}
              ownNumber={ownNumber}
              onOpen={() => {
                setEditorKey((value) => value + 1)
                setOpenId(automation.id)
              }}
            />
          </ItemGroup>
          <FlowSteps
            label={t.flows.stepsLabel(t.flows.names[automation.trigger])}
            steps={stepsOf(automation, language, businessName, t.flows)}
          />
        </div>
      ))}
      <AutomationEditor
        // A fresh editor each time it opens, from the saved words.
        key={editorKey}
        businessId={businessId}
        businessName={businessName}
        automation={open ?? null}
        limits={limits}
        onClose={() => setOpenId(null)}
      />
    </div>
  )
}

// The flow top to bottom: what starts it, what it sends, each button and
// what it does.
function stepsOf(
  automation: Automation,
  language: AutomationLanguage,
  businessName: string,
  t: ReturnType<typeof useOwnerMessages>["whatsapp"]["flows"]
): FlowStep[] {
  const words = automation.wording[language]
  return [
    {
      id: "trigger",
      icon: <MessageCircleIcon />,
      tone: "info",
      kicker: t.kickers.when,
      title: t.triggers[automation.trigger],
    },
    {
      id: "message",
      icon: <WhatsAppIcon />,
      tone: "success",
      kicker: t.kickers.send,
      title: words.body.replaceAll("{business}", businessName),
      branches: automation.buttons.map((button) => ({
        id: button.id,
        icon: ACTION_ICONS[button.action.type],
        kicker: t.kickers.button,
        title: button.label[language],
        description: t.actions[button.action.type],
      })),
    },
  ]
}

function FlowRow({
  businessId,
  automation,
  ownNumber,
  onOpen,
}: {
  businessId: string
  automation: Automation
  ownNumber: boolean
  onOpen: () => void
}) {
  const t = useOwnerMessages().whatsapp
  const router = useRouter()
  const [on, setOn] = useState(automation.on)
  const [pending, startTransition] = useTransition()
  const name = t.flows.names[automation.trigger]

  const toggle = (next: boolean) => {
    setOn(next)
    startTransition(async () => {
      const result = await setAutomationOn(businessId, automation.id, next).catch(() => null)
      if (result?.ok) {
        router.refresh()
      } else {
        setOn(!next)
        toast.error(result?.error === "noOwnNumber" ? t.flows.ownNumberOnly : t.failed)
      }
    })
  }

  return (
    <SwitchCard
      title={name}
      description={t.flows.about[automation.trigger]}
      openLabel={t.edit(name)}
      onOpen={onOpen}
      on={on}
      onCheckedChange={toggle}
      switchLabel={t.turnOn(name)}
      // Turning on needs the business's own number (D2); off always works.
      switchDisabled={pending || (!ownNumber && !on)}
    />
  )
}
