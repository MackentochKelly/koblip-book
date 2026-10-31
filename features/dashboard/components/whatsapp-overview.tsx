"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { PageSection } from "@/components/page-section"
import { StatCards } from "@/components/stat-cards"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import {
  ChevronDownIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
} from "@/components/ui/icons"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { PHONE_PATTERN } from "@/lib/booking-rules"
import { cn } from "@/lib/utils"
import { activityQuery } from "@/lib/whatsapp-activity-filter"
import type { ActivityStats } from "@/lib/whatsapp-activity"
import {
  saveNotificationSettings,
  sendTestToMyPhone,
  submitDraftsToMeta,
} from "../api/notification-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { ChatConnection } from "../types/chat-connection"
import type {
  NotificationMessage,
  NotificationSettings,
  Sender,
  SetupStep,
} from "../types/notifications"
import {
  TEMPLATE_LANGUAGES,
  type BookingMessage,
  type TemplateLanguage,
} from "../utils/booking-templates"
import { isCustomerMessage } from "../utils/customer-messages"
import {
  notificationStatus,
  type NextStep,
  type OverviewState,
} from "../utils/notification-status"
import { SETUP_STEPS } from "../utils/setup-steps"
import type { EditorLimits } from "./message-editor"
import { WhatsappMessageList } from "./whatsapp-message-list"

// Where each next step is done: in the business's Koblip Chat connection
// (Integrations) or on the Messages tab. "submit" is done right here.
const STEP_PLACES: Record<Exclude<NextStep, "submit">, "integrations" | "messages"> = {
  connect: "integrations",
  reconnect: "integrations",
  addNumber: "integrations",
  fix: "messages",
  review: "messages",
  turnOn: "messages",
}

// The Auto messages Overview (D36), top to bottom: one status with the next
// step, the own number's setup (folded away once live), the last days'
// numbers, the customer messages and a test to the owner's own phone.
export function WhatsappOverview({
  businessId,
  connection,
  sender,
  messages,
  waiting,
  settings,
  stats,
  statsDays,
  limits,
}: {
  businessId: string
  connection: ChatConnection | null
  sender: Sender | null
  messages: NotificationMessage[]
  // Messages Meta must still approve before the business's own number sends.
  waiting: BookingMessage[]
  settings: NotificationSettings
  stats: ActivityStats
  statsDays: number
  limits: EditorLimits
}) {
  const m = useOwnerMessages()
  const t = m.whatsapp
  const { state, next, steps } = notificationStatus(sender, connection, messages)
  // What "Submit to Meta" sends: the same drafts submitDraftsToMeta picks.
  const drafts = messages
    .filter((item) => item.on && item.editable)
    .map((item) => ({
      message: item.message,
      languages: TEMPLATE_LANGUAGES.filter((language) => item.texts[language].review === "draft"),
    }))
    .filter((item) => item.languages.length > 0)
  const base = `/dashboard/${businessId}/auto-messages`
  const activity = (state: "sent" | "read" | "replied" | "failed") =>
    `${base}/activity${activityQuery({ state })}`

  return (
    <div className="flex flex-col gap-10">
      <StatusCard
        businessId={businessId}
        connection={connection}
        sender={sender}
        state={state}
        next={next}
        waiting={waiting}
        drafts={drafts}
        freeTextInWindow={settings.freeTextInWindow}
      />

      {connection && !connection.needsReconnect && (
        <SetupProgress steps={steps} live={state === "live" && steps.live} />
      )}

      <PageSection id="stats" title={t.statsTitle(statsDays)}>
        <StatCards
          locale={m.locale}
          stats={(["sent", "read", "replied", "failed"] as const).map((key) => ({
            label: t.stats[key],
            value: stats[key],
            href: activity(key),
          }))}
        />
      </PageSection>

      <PageSection id="your-messages" title={t.yourMessages}>
        <WhatsappMessageList
          businessId={businessId}
          limits={limits}
          messages={messages.filter((item) => isCustomerMessage(item.message))}
        />
      </PageSection>

      {sender && (
        <PageSection id="test" title={t.test}>
          <TestSend
            businessId={businessId}
            messages={messages.map((item) => item.message)}
            settings={settings}
          />
        </PageSection>
      )}
    </div>
  )
}

// One state as a Badge, the number that sends, why Koblip's number still
// sends when the own one waits for Meta (D34, D35), and one main button.
function StatusCard({
  businessId,
  connection,
  sender,
  state,
  next,
  waiting,
  drafts,
  freeTextInWindow,
}: {
  businessId: string
  connection: ChatConnection | null
  sender: Sender | null
  state: OverviewState
  next: NextStep | null
  waiting: BookingMessage[]
  // The drafts "Submit to Meta" sends, each with its languages.
  drafts: { message: BookingMessage; languages: TemplateLanguage[] }[]
  freeTextInWindow: boolean
}) {
  const m = useOwnerMessages()
  const t = m.whatsapp
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // "Submit to Meta" asks first, naming what goes (D37).
  const [asking, setAsking] = useState(false)
  const list = new Intl.ListFormat(m.locale, { type: "conjunction" })
  const draftCount = drafts.reduce((sum, item) => sum + item.languages.length, 0)
  const draftList = list.format(
    drafts.map(
      (item) =>
        `${t.names[item.message]} (${list.format(
          item.languages.map((language) => (language === "en" ? t.english : t.spanish))
        )})`
    )
  )
  const own = connection && !connection.needsReconnect ? connection : null
  const until = freeTextInWindow ? t.untilApprovedWindow : t.untilApproved
  // One short line: why Koblip's number sends, else the channel.
  const line = waiting.length
    ? until(
        new Intl.ListFormat(m.locale, { type: "conjunction" }).format(
          waiting.map((message) => t.names[message])
        )
      )
    : own
      ? `${t.channel} · ${own.workspaceName}`
      : t.channel

  const submit = () =>
    startTransition(async () => {
      const result = await submitDraftsToMeta(businessId).catch(() => null)
      if (result?.ok) {
        toast.success(t.submitted)
        router.refresh()
      } else if (result && "reason" in result) {
        // Meta refused at once: its own words.
        toast.error(result.reason)
      } else {
        toast.error((result && t.problems[result.error]) ?? t.failed)
      }
    })

  const placeOf = (step: Exclude<NextStep, "submit">) =>
    STEP_PLACES[step] === "integrations"
      ? `/dashboard/${businessId}/integrations`
      : `/dashboard/${businessId}/auto-messages/messages`

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sender ? t.sendingFrom[sender] : own?.workspaceName ?? t.channel}</CardTitle>
        <CardAction>
          <StateBadge state={state} />
        </CardAction>
        {/* The whole line, never cut short (Spanish runs longer). */}
        <CardDescription>{line}</CardDescription>
      </CardHeader>
      {(next || !connection) && (
        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          {next === "submit" ? (
            <>
              <Button
                className="w-full sm:w-auto"
                disabled={pending || draftCount === 0}
                onClick={() => setAsking(true)}
              >
                {pending && <Spinner data-icon="inline-start" />}
                {t.nextSteps.submit}
              </Button>
              <ConfirmDialog
                open={asking}
                title={t.submitTitle(draftCount)}
                description={draftList}
                confirm={t.submitConfirm}
                cancel={t.submitCancel}
                tone="default"
                onConfirm={submit}
                onClose={() => setAsking(false)}
              />
            </>
          ) : next ? (
            <Button
              className="w-full sm:w-auto"
              nativeButton={false}
              render={<Link href={placeOf(next)} />}
            >
              {t.nextSteps[next]}
            </Button>
          ) : (
            // On Koblip's number nothing is left to do; its own number is
            // optional, so not the main action.
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              nativeButton={false}
              render={<Link href={`/dashboard/${businessId}/integrations`} />}
            >
              {t.useOwnNumber}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}

function StateBadge({ state }: { state: OverviewState }) {
  const t = useOwnerMessages().whatsapp
  return (
    <Badge variant={state === "live" ? "secondary" : state === "action" ? "default" : "outline"}>
      {state === "live" && <CircleCheckIcon data-icon="inline-start" className="text-success" />}
      {state === "action" && <CircleAlertIcon data-icon="inline-start" />}
      {state === "waiting" && <ClockIcon data-icon="inline-start" />}
      {t.overviewStates[state]}
    </Badge>
  )
}

// The own number's setup steps (D23) with a bar: done ones checked, the
// current one marked with what to do, the rest muted. Folded away once live.
function SetupProgress({ steps, live }: { steps: Record<SetupStep, boolean>; live: boolean }) {
  const t = useOwnerMessages().whatsapp
  const done = SETUP_STEPS.filter((step) => steps[step]).length
  const current = SETUP_STEPS.find((step) => !steps[step])

  const content = (
    <div className="flex flex-col gap-4">
      <Progress value={(done / SETUP_STEPS.length) * 100}>
        <ProgressLabel className="sr-only">{t.setup}</ProgressLabel>
        <ProgressValue>{() => t.setupProgress(done, SETUP_STEPS.length)}</ProgressValue>
      </Progress>
      <ItemGroup className="gap-1">
        {SETUP_STEPS.map((step, index) => {
          const isCurrent = step === current
          return (
            <Item
              key={step}
              role="listitem"
              size="sm"
              variant={isCurrent ? "outline" : "default"}
              aria-current={isCurrent ? "step" : undefined}
            >
              <ItemMedia variant="icon">
                {steps[step] ? (
                  <CircleCheckIcon className="text-success" />
                ) : (
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isCurrent ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {index + 1}
                  </span>
                )}
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className={cn(!steps[step] && !isCurrent && "text-muted-foreground")}>
                  {t.steps[step]}
                  <span className="sr-only">
                    {" "}
                    ({steps[step] ? t.stepDone : isCurrent ? t.stepNow : t.stepToDo})
                  </span>
                </ItemTitle>
                {isCurrent && (
                  <ItemDescription className="line-clamp-none">{t.stepHints[step]}</ItemDescription>
                )}
              </ItemContent>
            </Item>
          )
        })}
      </ItemGroup>
    </div>
  )

  if (live) {
    return (
      <Collapsible>
        <CollapsibleTrigger
          render={<Button variant="ghost" className="group -ml-2.5 w-fit" />}
        >
          <CircleCheckIcon data-icon="inline-start" className="text-success" />
          {t.setupDone}
          <ChevronDownIcon
            data-icon="inline-end"
            className="transition-transform group-data-[panel-open]:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">{content}</CollapsibleContent>
      </Collapsible>
    )
  }
  return (
    <PageSection id="setup" title={t.setup}>
      {content}
    </PageSection>
  )
}

// Sends one message now to the owner's own WhatsApp, as customers get it.
// Without the owner's WhatsApp saved, a field to add it takes its place.
function TestSend({
  businessId,
  messages,
  settings,
}: {
  businessId: string
  messages: BookingMessage[]
  settings: NotificationSettings
}) {
  const t = useOwnerMessages().whatsapp
  // The reminder by default: it has the answer buttons.
  const [message, setMessage] = useState<BookingMessage>(
    messages.includes("reminder") ? "reminder" : messages[0]
  )
  const [pending, startTransition] = useTransition()
  const items = messages.map((item) => ({ value: item, label: t.names[item] }))

  if (!settings.ownerPhone) return <OwnerPhoneField businessId={businessId} settings={settings} />

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
        <Button disabled={pending} onClick={send}>
          {pending && <Spinner data-icon="inline-start" />}
          {t.sendTest}
        </Button>
      </div>
    </Field>
  )
}

// The owner's WhatsApp, saved with the other settings as they are; the test
// shows once it is saved.
function OwnerPhoneField({
  businessId,
  settings,
}: {
  businessId: string
  settings: NotificationSettings
}) {
  const m = useOwnerMessages()
  const t = m.whatsapp
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [badPhone, setBadPhone] = useState(false)
  const [pending, startTransition] = useTransition()

  const save = () => {
    const value = phone.trim()
    if (!PHONE_PATTERN.test(value)) {
      setBadPhone(true)
      return
    }
    setBadPhone(false)
    startTransition(async () => {
      const result = await saveNotificationSettings(businessId, {
        ownerPhone: value,
        // The owner's alerts go in the language they use Book in.
        ownerLanguage: m.locale.startsWith("es") ? "es" : "en",
        reminders: settings.reminders,
        quietStart: settings.quietStart,
        quietEnd: settings.quietEnd,
      }).catch(() => null)
      if (result?.ok) {
        toast.success(t.settingsSaved)
        router.refresh()
      } else {
        toast.error(t.failed)
      }
    })
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <Field data-invalid={badPhone || undefined}>
        <FieldLabel htmlFor="test-owner-phone">{t.yourNumber}</FieldLabel>
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            id="test-owner-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+1 809 555 0000"
            className="md:flex-1"
            value={phone}
            aria-invalid={badPhone || undefined}
            onChange={(event) => setPhone(event.target.value)}
          />
          <Button type="submit" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {t.saveSettings}
          </Button>
        </div>
        {badPhone ? (
          <FieldError>{t.badPhone}</FieldError>
        ) : (
          <FieldDescription>{t.testPhoneHint}</FieldDescription>
        )}
      </Field>
    </form>
  )
}
