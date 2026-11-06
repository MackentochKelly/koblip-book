"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { SwitchCard } from "@/components/switch-card"
import { ItemGroup } from "@/components/ui/item"
import { languageOf } from "@/lib/page-language"
import { setAutomationOn } from "../api/automation-actions"
import type { Automation, AutomationAction, AutomationLanguage } from "../types/automations"
import { AutomationEditor, type AutomationLimits } from "./automation-editor"
import { WhatsappFlowCanvas } from "./whatsapp-flow-canvas"

// Flows: each automation as a card with its switch, like Messages, and its
// canvas under it; the card and the canvas open its editor (D11). Flows answer only on the
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
  // The button the editor opens with, added from the canvas's side.
  const [adding, setAdding] = useState<AutomationAction["type"] | undefined>()
  const t = useTranslations("owner.whatsapp")
  const locale = useLocale()
  const open = automations.find((item) => item.id === openId)
  // The owner reads the words in their own language.
  const language: AutomationLanguage = languageOf(locale)
  const openEditor = (id: string, action?: AutomationAction["type"]) => {
    setAdding(action)
    setEditorKey((value) => value + 1)
    setOpenId(id)
  }

  return (
    <div className="flex flex-col gap-3">
      {!ownNumber && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t("flows.ownNumberOnly")}</p>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/dashboard/${businessId}/integrations`} />}
          >
            {t("useOwnNumber")}
          </Button>
        </div>
      )}
      {/* Each flow: its card with the switch, then its canvas. */}
      {automations.map((automation) => (
        <div key={automation.id} className="flex flex-col gap-3">
          <ItemGroup>
            <FlowRow
              businessId={businessId}
              automation={automation}
              ownNumber={ownNumber}
              onOpen={() => openEditor(automation.id)}
            />
          </ItemGroup>
          <WhatsappFlowCanvas
            automation={automation}
            businessName={businessName}
            language={language}
            maxButtons={limits.maxButtons}
            onOpen={(action) => openEditor(automation.id, action)}
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
        adding={adding}
        onClose={() => setOpenId(null)}
      />
    </div>
  )
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
  const t = useTranslations("owner.whatsapp")
  const router = useRouter()
  const [on, setOn] = useState(automation.on)
  const [pending, startTransition] = useTransition()
  const name = t(`flows.names.${automation.trigger}`)

  const toggle = (next: boolean) => {
    setOn(next)
    startTransition(async () => {
      const result = await setAutomationOn(businessId, automation.id, next).catch(() => null)
      if (result?.ok) {
        router.refresh()
      } else {
        setOn(!next)
        toast.error(result?.error === "noOwnNumber" ? t("flows.ownNumberOnly") : t("failed"))
      }
    })
  }

  return (
    <SwitchCard
      title={name}
      description={t(`flows.about.${automation.trigger}`)}
      openLabel={t("edit", { name: name.toLowerCase() })}
      onOpen={onOpen}
      on={on}
      onCheckedChange={toggle}
      switchLabel={t("turnOn", { name: name.toLowerCase() })}
      // Turning on needs the business's own number (D2); off always works.
      switchDisabled={pending || (!ownNumber && !on)}
    />
  )
}
