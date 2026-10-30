"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { CalendarDaysIcon, RefreshIcon, SearchIcon, XIcon } from "@/components/ui/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
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
import { noAutofill } from "@/lib/no-autofill"
import { cn } from "@/lib/utils"
import { ACTIVITY_STATES, activityQuery } from "@/lib/whatsapp-activity-filter"
import { BOOKING_MESSAGES } from "@/lib/whatsapp-messages"
import type {
  ActivityFilter,
  ButtonAction,
  NotificationSend,
  SendKind,
} from "@/types/whatsapp"

// "Any" in a filter's menu: the filter is off.
const ANY = "any"

// The words the list shows, in the page's language (the business page's
// and the admin's i18n each give them).
export type ActivityLabels = {
  locale: string
  names: Record<SendKind, string>
  noHistory: string
  search: string
  searchLabel: string
  messageFilter: string
  stateFilter: string
  allMessages: string
  allStates: string
  noneFound: string
  clearFilters: string
  via: Record<NonNullable<NotificationSend["via"]>, string>
  replies: Record<ButtonAction, string>
  states: Record<string, string>
  // Why a message was not sent; anything else reads as `other`.
  reasons: Record<string, string>
  sendAgain: string
  sendAgainLabel: (name: string) => string
  sentAgain: string
  sendAgainFailed: string
  sendAgainProblems: Record<string, string>
  // Only where a waiting message can be cancelled (the admin).
  cancelSend?: {
    label: (name: string) => string
    title: string
    text: string
    confirm: string
    keep: string
    done: string
    failed: string
    problems: Record<string, string>
  }
}

type Row = NotificationSend & { businessName?: string; timeZone?: string }
type Result = { ok: true } | { ok: false; error?: string }

// Activity, on the business page (P7) and in the admin (A5): every message,
// who, which, when, normal or template, whether it went and the customer's
// answer; filtered by message and status, searched by name or phone (the
// filters are in the address, D14). A failed message can be sent again; with
// `onCancel`, a waiting one can be cancelled. With `showBusiness`, each row
// names its business and shows its time in that business's time zone.
export function WhatsappActivityList({
  rows,
  filter,
  timeZone,
  labels: t,
  showBusiness = false,
  onSendAgain,
  onCancel,
}: {
  rows: Row[]
  filter: ActivityFilter
  timeZone?: string
  labels: ActivityLabels
  showBusiness?: boolean
  onSendAgain: (id: string) => Promise<Result>
  onCancel?: (id: string) => Promise<Result>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(filter.search ?? "")
  const [pending, startTransition] = useTransition()
  const filtered = !!(filter.message || filter.state || filter.search)
  const formatters = new Map<string, Intl.DateTimeFormat>()
  const when = (row: Row) => {
    const zone = row.timeZone ?? timeZone
    const key = zone ?? ""
    let format = formatters.get(key)
    if (!format) {
      format = new Intl.DateTimeFormat(t.locale, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: zone,
      })
      formatters.set(key, format)
    }
    return format.format(new Date(row.at))
  }

  const show = (next: ActivityFilter) =>
    startTransition(() => {
      router.replace(`${pathname}${activityQuery(next)}`, { scroll: false })
    })

  const messageItems = [
    { value: ANY, label: t.allMessages },
    ...BOOKING_MESSAGES.map((message) => ({ value: message, label: t.names[message] })),
  ]
  const stateItems = [
    { value: ANY, label: t.allStates },
    ...ACTIVITY_STATES.map((state) => ({ value: state, label: t.states[state] })),
  ]

  // Nothing sent yet and no filter on: nothing to filter either.
  if (rows.length === 0 && !filtered) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarDaysIcon />
          </EmptyMedia>
          <EmptyTitle>{t.noHistory}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row">
        {/* Search runs on Enter, like a mail search: one query per search. */}
        <form
          role="search"
          className="md:flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            show({ ...filter, search: query.trim() || undefined })
          }}
        >
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              {...noAutofill("activity")}
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.search}
              aria-label={t.searchLabel}
            />
          </InputGroup>
        </form>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex">
          <Select
            items={messageItems}
            value={filter.message ?? ANY}
            onValueChange={(value) =>
              show({
                ...filter,
                message: value === ANY ? undefined : (value as ActivityFilter["message"]),
              })
            }
          >
            <SelectTrigger className="w-full md:w-auto" aria-label={t.messageFilter}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {messageItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={stateItems}
            value={filter.state ?? ANY}
            onValueChange={(value) =>
              show({
                ...filter,
                state: value === ANY ? undefined : (value as ActivityFilter["state"]),
              })
            }
          >
            <SelectTrigger className="w-full md:w-auto" aria-label={t.stateFilter}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stateItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div aria-busy={pending} className={cn("transition-opacity", pending && "opacity-60")}>
        {rows.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon />
              </EmptyMedia>
              <EmptyTitle>{t.noneFound}</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("")
                  show({})
                }}
              >
                {t.clearFilters}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ItemGroup className="gap-2">
            {rows.map((row) => {
              const shown = row.state === "sent" && row.delivery ? row.delivery : row.state
              const reason = row.reason && (t.reasons[row.reason] ?? t.reasons.other)
              return (
                <Item key={row.id} variant="outline" size="sm">
                  <ItemContent className="min-w-0">
                    <ItemTitle>{t.names[row.message]}</ItemTitle>
                    <ItemDescription>
                      {[
                        showBusiness && row.businessName,
                        row.customerName,
                        when(row),
                        row.via && t.via[row.via],
                        reason,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="flex-col items-end gap-1">
                    <Badge
                      variant={
                        shown === "failed"
                          ? "destructive"
                          : shown === "skipped" || shown === "pending"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {t.states[shown] ?? shown}
                    </Badge>
                    {row.reply && <Badge variant="outline">{t.replies[row.reply.action]}</Badge>}
                    {row.state === "failed" && (
                      <SendAgainButton row={row} labels={t} onSendAgain={onSendAgain} />
                    )}
                    {row.state === "pending" && onCancel && t.cancelSend && (
                      <CancelButton row={row} labels={t} onCancel={onCancel} />
                    )}
                  </ItemActions>
                </Item>
              )
            })}
          </ItemGroup>
        )}
      </div>
    </div>
  )
}

// Puts a failed message back in line; the next check sends it (D17).
function SendAgainButton({
  row,
  labels: t,
  onSendAgain,
}: {
  row: Row
  labels: ActivityLabels
  onSendAgain: (id: string) => Promise<Result>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const again = () =>
    startTransition(async () => {
      const result = await onSendAgain(row.id).catch(() => null)
      if (result?.ok) {
        toast.success(t.sentAgain)
      } else {
        toast.error((result?.error && t.sendAgainProblems[result.error]) || t.sendAgainFailed)
      }
      if (result) router.refresh()
    })
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={again}
      aria-label={t.sendAgainLabel(t.names[row.message])}
    >
      {pending ? <Spinner data-icon="inline-start" /> : <RefreshIcon data-icon="inline-start" />}
      {t.sendAgain}
    </Button>
  )
}

// Cancels a waiting message, after asking: it is kept as not sent.
function CancelButton({
  row,
  labels,
  onCancel,
}: {
  row: Row
  labels: ActivityLabels
  onCancel: (id: string) => Promise<Result>
}) {
  const t = labels.cancelSend!
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const name = labels.names[row.message]
  const cancel = () =>
    startTransition(async () => {
      const result = await onCancel(row.id).catch(() => null)
      if (result?.ok) {
        toast.success(t.done)
      } else {
        toast.error((result?.error && t.problems[result.error]) || t.failed)
      }
      if (result) router.refresh()
    })
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => setAsking(true)}
        aria-label={t.label(name)}
      >
        {pending ? <Spinner data-icon="inline-start" /> : <XIcon data-icon="inline-start" />}
        {t.confirm}
      </Button>
      <ConfirmDialog
        open={asking}
        title={t.title}
        description={t.text}
        confirm={t.confirm}
        cancel={t.keep}
        onConfirm={cancel}
        onClose={() => setAsking(false)}
      />
    </>
  )
}
