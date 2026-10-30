"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { CalendarDaysIcon, SearchIcon } from "@/components/ui/icons"

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
import { noAutofill } from "@/lib/no-autofill"
import { cn } from "@/lib/utils"
import { useOwnerMessages } from "../i18n/provider"
import type { ActivityFilter, NotificationSend } from "../types/notifications"
import { ACTIVITY_STATES, activityQuery } from "../utils/activity-filter"
import { BOOKING_MESSAGES } from "../utils/booking-templates"

// "Any" in a filter's menu: the filter is off.
const ANY = "any"

// Activity: every message, who, which, when, normal or template, whether it
// went and the customer's answer; filtered by message and status, searched
// by name or phone. The filters are in the address (activity-filter.ts).
export function WhatsappActivity({
  history,
  filter,
  timeZone,
}: {
  history: NotificationSend[]
  filter: ActivityFilter
  timeZone: string
}) {
  const m = useOwnerMessages()
  const t = m.whatsapp
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(filter.search ?? "")
  const [pending, startTransition] = useTransition()
  const filtered = !!(filter.message || filter.state || filter.search)
  const when = new Intl.DateTimeFormat(m.locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  })

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
  if (history.length === 0 && !filtered) {
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
        {history.length === 0 ? (
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
            {history.map((send) => {
              const shown = send.state === "sent" && send.delivery ? send.delivery : send.state
              const reason = send.reason && (t.reasons[send.reason] ?? t.reasons.other)
              return (
                <Item key={send.id} variant="outline" size="sm">
                  <ItemContent className="min-w-0">
                    <ItemTitle>{t.names[send.message]}</ItemTitle>
                    <ItemDescription>
                      {[
                        send.customerName,
                        when.format(new Date(send.at)),
                        send.via && t.via[send.via],
                        reason,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="flex-col items-end gap-1">
                    <Badge
                      variant={
                        shown === "failed" ? "destructive" : shown === "skipped" || shown === "pending" ? "outline" : "secondary"
                      }
                    >
                      {t.states[shown] ?? shown}
                    </Badge>
                    {send.reply && <Badge variant="outline">{t.replies[send.reply.action]}</Badge>}
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
