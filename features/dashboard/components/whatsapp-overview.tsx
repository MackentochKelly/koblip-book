"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { CircleCheckIcon, MessageCircleIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { PageSection } from "@/components/page-section"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { sendTestToMyPhone } from "../api/notification-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { ChatConnection } from "../types/chat-connection"
import type { NotificationMessage, SetupStep } from "../types/notifications"
import type { BookingMessage } from "../utils/booking-templates"
import { SETUP_STEPS, setupSteps } from "../utils/setup-steps"

// Where the owner fixes each step that is not done yet.
const STEP_PARTS: Record<SetupStep, "integrations" | "messages"> = {
  connected: "integrations",
  reviewed: "messages",
  submitted: "messages",
  approved: "messages",
  live: "messages",
}

// Overview: which Koblip Chat workspace sends the messages, the setup
// checklist (D23) and a test to the owner's own phone (S8, D17).
export function WhatsappOverview({
  businessId,
  connection,
  messages,
  ownerPhone,
}: {
  businessId: string
  connection: ChatConnection | null
  messages: NotificationMessage[]
  ownerPhone: string | null
}) {
  const m = useOwnerMessages()
  const t = m.whatsapp
  if (!connection) return null
  const state = connection.messages
  const steps = setupSteps(connection, messages)
  // Only the first step not done says what to do next.
  const next = SETUP_STEPS.find((step) => !steps[step])
  const hrefOf = (step: SetupStep) =>
    STEP_PARTS[step] === "integrations"
      ? `/dashboard/${businessId}/integrations`
      : `/dashboard/${businessId}/whatsapp/messages`

  return (
    <div className="flex flex-col gap-10">
      <Item variant="outline">
        <ItemMedia variant="icon">
          <MessageCircleIcon />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle>{connection.workspaceName}</ItemTitle>
          {/* The whole status, never cut short (Spanish runs longer). */}
          <ItemDescription className="line-clamp-none">
            {state === "ready" ? t.ready : m.integrations.koblipChat.messages[state]}
          </ItemDescription>
        </ItemContent>
      </Item>

      <PageSection id="setup" title={t.setup}>
        <ItemGroup className="gap-2">
          {SETUP_STEPS.map((step, index) => (
            <Item key={step} role="listitem" variant="outline" size="sm">
              <ItemMedia variant="icon">
                {steps[step] ? (
                  <CircleCheckIcon className="text-primary" />
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>
                )}
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle>
                  {t.steps[step]}
                  <span className="sr-only">
                    {" "}
                    ({steps[step] ? t.stepDone : t.stepToDo})
                  </span>
                </ItemTitle>
                {step === next && (
                  <ItemDescription className="line-clamp-none">
                    {t.stepHints[step]}
                  </ItemDescription>
                )}
              </ItemContent>
              {step === next && step !== "approved" && (
                <ItemActions>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={hrefOf(step)} />}
                  >
                    {t.open}
                  </Button>
                </ItemActions>
              )}
            </Item>
          ))}
        </ItemGroup>
      </PageSection>

      <PageSection id="test" title={t.test}>
        <TestSend
          businessId={businessId}
          messages={messages.map((item) => item.message)}
          ownerPhone={ownerPhone}
        />
      </PageSection>
    </div>
  )
}

// Sends one message now to the owner's own WhatsApp, as customers get it.
function TestSend({
  businessId,
  messages,
  ownerPhone,
}: {
  businessId: string
  messages: BookingMessage[]
  ownerPhone: string | null
}) {
  const t = useOwnerMessages().whatsapp
  // The reminder by default: it has the answer buttons.
  const [message, setMessage] = useState<BookingMessage>(
    messages.includes("reminder") ? "reminder" : messages[0]
  )
  const [pending, startTransition] = useTransition()
  const items = messages.map((item) => ({ value: item, label: t.names[item] }))

  const send = () =>
    startTransition(async () => {
      const result = await sendTestToMyPhone(businessId, message).catch(() => null)
      if (result?.ok) {
        toast.success(t.testSent)
      } else {
        toast.error((result && t.reasons[result.error]) ?? t.testFailed)
      }
    })

  return (
    <Field>
      <FieldLabel htmlFor="test-message">{t.testMessage}</FieldLabel>
      <div className="flex flex-col gap-2 md:flex-row">
        <Select
          items={items}
          value={message}
          onValueChange={(value) => value && setMessage(value as BookingMessage)}
        >
          <SelectTrigger id="test-message" className="w-full md:flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button disabled={pending || !ownerPhone} onClick={send}>
          {pending && <Spinner data-icon="inline-start" />}
          {t.sendTest}
        </Button>
      </div>
      {!ownerPhone && (
        <FieldDescription>
          <Link href={`/dashboard/${businessId}/whatsapp/alerts`}>{t.testNeedsPhone}</Link>
        </FieldDescription>
      )}
    </Field>
  )
}
