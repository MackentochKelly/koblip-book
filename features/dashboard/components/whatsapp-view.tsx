"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MessageCircleIcon, PlusIcon, XIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { PageSection } from "@/components/page-section"
import { TimeInput } from "@/components/time-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
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
import { Switch } from "@/components/ui/switch"
import { PHONE_PATTERN } from "@/lib/booking-rules"
import { formatDuration } from "@/lib/format-duration"
import { NOTIFICATION_RULES } from "@/lib/notification-rules"
import { refreshChatMessages } from "../api/chat-connection"
import {
  saveNotificationSettings,
  setMessageOn,
} from "../api/notification-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { ChatConnection } from "../types/chat-connection"
import type {
  NotificationMessage,
  NotificationSend,
  NotificationSettings,
  TemplateReview,
} from "../types/notifications"
import { MessageEditor } from "./message-editor"

// The WhatsApp page: the booking notifications a business sends through
// Koblip Chat. Each message has a switch and opens to edit its wording;
// below, the reminder times, quiet hours, the owner's own number and the
// history of what was sent.
export function WhatsappView({
  businessId,
  connection,
  settings,
  messages,
  history,
  timeZone,
}: {
  businessId: string
  connection: ChatConnection | null
  settings: NotificationSettings
  messages: NotificationMessage[]
  history: NotificationSend[]
  timeZone: string
}) {
  const m = useOwnerMessages()
  const t = m.whatsapp
  const router = useRouter()
  const [editing, setEditing] = useState<NotificationMessage | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const usable = !!connection && !connection.needsReconnect
  const state = connection?.messages ?? null

  // While not every template is approved, opening the page makes any that
  // are missing in Chat and reads Meta's review; a new answer reloads.
  useEffect(() => {
    if (!usable || state === "ready") return
    let current = true
    refreshChatMessages(businessId)
      .then((next) => {
        if (current && next !== state) router.refresh()
      })
      // Chat out of reach: the page keeps what it showed.
      .catch(() => null)
    return () => {
      current = false
    }
  }, [businessId, usable, state, router])

  if (!usable) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{m.shell.nav.whatsapp}</h1>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageCircleIcon />
            </EmptyMedia>
            <EmptyTitle>{t.connectTitle}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button
              nativeButton={false}
              render={<Link href={`/dashboard/${businessId}/integrations`} />}
            >
              {connection ? m.integrations.koblipChat.reconnect : t.connect}
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{m.shell.nav.whatsapp}</h1>
        {state !== "ready" && (
          <p className="text-sm text-muted-foreground">
            {m.integrations.koblipChat.messages[state ?? "settingUp"]}
          </p>
        )}
      </div>

      <PageSection id="messages" title={t.messages}>
        <ItemGroup className="gap-3">
          {messages.map((item) => (
            <MessageRow
              key={item.message}
              businessId={businessId}
              item={item}
              onEdit={() => {
                setEditorKey((value) => value + 1)
                setEditing(item)
              }}
            />
          ))}
        </ItemGroup>
      </PageSection>

      <SettingsForm businessId={businessId} settings={settings} />

      <History history={history} timeZone={timeZone} />

      <MessageEditor
        key={editorKey}
        businessId={businessId}
        item={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

// The review a message shows: the worse of its two languages.
function reviewOf(item: NotificationMessage): TemplateReview {
  const both = [item.texts.en.review, item.texts.es.review]
  for (const review of ["rejected", "missing", "waiting"] as const) {
    if (both.includes(review)) return review
  }
  return "approved"
}

function MessageRow({
  businessId,
  item,
  onEdit,
}: {
  businessId: string
  item: NotificationMessage
  onEdit: () => void
}) {
  const t = useOwnerMessages().whatsapp
  const router = useRouter()
  const [on, setOn] = useState(item.on)
  const [pending, startTransition] = useTransition()
  const name = t.names[item.message]
  const review = reviewOf(item)

  const toggle = (next: boolean) => {
    setOn(next)
    startTransition(async () => {
      const result = await setMessageOn(businessId, item.message, next).catch(() => null)
      if (result?.ok) {
        router.refresh()
      } else {
        setOn(!next)
        toast.error(t.failed)
      }
    })
  }

  return (
    <Item variant="outline">
      {/* The text opens the editor; the switch is its own control. */}
      <ItemContent className="min-w-0">
        <button
          type="button"
          onClick={onEdit}
          aria-label={t.edit(name)}
          className="flex min-h-11 flex-col items-start justify-center gap-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ItemTitle>{name}</ItemTitle>
          <ItemDescription>{t.about[item.message]}</ItemDescription>
        </button>
        {review !== "approved" && (
          <Badge
            variant={review === "rejected" ? "destructive" : "secondary"}
            className="mt-1"
          >
            {t.review[review]}
          </Badge>
        )}
      </ItemContent>
      <ItemActions>
        <Switch
          checked={on}
          disabled={pending}
          onCheckedChange={toggle}
          aria-label={t.turnOn(name)}
        />
      </ItemActions>
    </Item>
  )
}

// Reminder times, quiet hours and the owner's number, saved together.
function SettingsForm({
  businessId,
  settings,
}: {
  businessId: string
  settings: NotificationSettings
}) {
  const m = useOwnerMessages()
  const t = m.whatsapp
  const router = useRouter()
  const [reminders, setReminders] = useState(settings.reminders)
  const [adding, setAdding] = useState<string | null>(null)
  const [quietStart, setQuietStart] = useState(settings.quietStart)
  const [quietEnd, setQuietEnd] = useState(settings.quietEnd)
  const [phone, setPhone] = useState(settings.ownerPhone ?? "")
  const [badPhone, setBadPhone] = useState(false)
  const [pending, startTransition] = useTransition()

  const choices = NOTIFICATION_RULES.reminderChoices.filter(
    (minutes) => !reminders.includes(minutes)
  )
  const full = reminders.length >= NOTIFICATION_RULES.maxReminders
  const items = choices.map((minutes) => ({
    value: String(minutes),
    label: t.before(formatDuration(minutes)),
  }))

  const save = () => {
    if (phone.trim() && !PHONE_PATTERN.test(phone.trim())) {
      setBadPhone(true)
      return
    }
    setBadPhone(false)
    startTransition(async () => {
      const result = await saveNotificationSettings(businessId, {
        ownerPhone: phone.trim() || null,
        // The owner's alert goes in the language they use Book in.
        ownerLanguage: m.locale.startsWith("es") ? "es" : "en",
        reminders,
        quietStart,
        quietEnd,
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
    <>
      <PageSection id="reminders" title={t.reminders}>
        <ItemGroup className="gap-3">
          {reminders.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.noReminders}</p>
          )}
          {[...reminders]
            .sort((a, b) => b - a)
            .map((minutes) => {
              const time = formatDuration(minutes)
              return (
                <Item key={minutes} variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle>{t.before(time)}</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t.removeReminder(time)}
                      onClick={() =>
                        setReminders((list) => list.filter((value) => value !== minutes))
                      }
                    >
                      <XIcon />
                    </Button>
                  </ItemActions>
                </Item>
              )
            })}
        </ItemGroup>
        {!full && (
          <Field orientation="horizontal">
            <Select
              items={items}
              value={adding}
              onValueChange={(value) => setAdding(value ? String(value) : null)}
            >
              <SelectTrigger className="flex-1" aria-label={t.addReminder}>
                <SelectValue placeholder={t.addReminder} />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!adding}
              onClick={() => {
                if (!adding) return
                setReminders((list) => [...list, Number(adding)])
                setAdding(null)
              }}
            >
              <PlusIcon data-icon="inline-start" />
              {t.addField}
            </Button>
          </Field>
        )}
      </PageSection>

      <PageSection id="quiet-hours" title={t.quietHours}>
        <FieldGroup>
          <Field>
            <FieldDescription>{t.quietHint}</FieldDescription>
            <div className="flex items-center gap-2">
              <TimeInput
                aria-label={t.from}
                value={quietStart}
                onChange={(event) => setQuietStart(event.target.value)}
              />
              <span className="text-muted-foreground">–</span>
              <TimeInput
                aria-label={t.to}
                value={quietEnd}
                onChange={(event) => setQuietEnd(event.target.value)}
              />
            </div>
          </Field>
        </FieldGroup>
      </PageSection>

      <PageSection id="your-number" title={t.yourNumber}>
        <Field data-invalid={badPhone || undefined}>
          <FieldLabel htmlFor="owner-whatsapp" className="sr-only">
            {t.yourNumber}
          </FieldLabel>
          <Input
            id="owner-whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+1 809 555 0000"
            value={phone}
            aria-invalid={badPhone || undefined}
            onChange={(event) => setPhone(event.target.value)}
          />
          {badPhone ? (
            <FieldError>{t.badPhone}</FieldError>
          ) : (
            <FieldDescription>{t.yourNumberHint}</FieldDescription>
          )}
        </Field>
      </PageSection>

      <Button size="lg" onClick={save} disabled={pending}>
        {pending && <Spinner data-icon="inline-start" />}
        {t.saveSettings}
      </Button>
    </>
  )
}

// The latest messages: who, when, and whether they went.
function History({ history, timeZone }: { history: NotificationSend[]; timeZone: string }) {
  const m = useOwnerMessages()
  const t = m.whatsapp
  const when = new Intl.DateTimeFormat(m.locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  })

  return (
    <PageSection id="history" title={t.history}>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noHistory}</p>
      ) : (
        <ItemGroup className="gap-2">
          {history.map((send) => {
            const shown = send.state === "sent" && send.delivery ? send.delivery : send.state
            const reason = send.reason && (t.reasons[send.reason] ?? t.reasons.other)
            return (
              <Item key={send.id} variant="outline" size="sm">
                <ItemContent className="min-w-0">
                  <ItemTitle>{t.names[send.message]}</ItemTitle>
                  <ItemDescription>
                    {[send.customerName, when.format(new Date(send.at)), reason]
                      .filter(Boolean)
                      .join(" · ")}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge
                    variant={
                      shown === "failed" ? "destructive" : shown === "skipped" || shown === "pending" ? "outline" : "secondary"
                    }
                  >
                    {t.states[shown] ?? shown}
                  </Badge>
                </ItemActions>
              </Item>
            )
          })}
        </ItemGroup>
      )}
    </PageSection>
  )
}
