"use client"

import { useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { BellIcon, SearchIcon } from "@/components/ui/icons"
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
import { cn } from "@/lib/utils"
import { IN_APP_KINDS } from "@/types/in-app-notifications"
import type { AdminNotification, AdminNotifications } from "../api/notifications"
import { useAdminMessages } from "../i18n/provider"
import {
  NOTIFICATION_READ_FILTERS,
  notificationQuery,
  type NotificationFilter,
} from "../utils/notification-filter"
import { AdminPage } from "./admin-page"

const ANY = "any"

// Notifications (in-app N6): every stored notification, newest first, each
// at its business's clock time, filtered by business, kind and read; then
// the kinds each owner turned off.
export function AdminNotificationsList({
  rows,
  businesses,
  choices,
  filter,
}: AdminNotifications & { filter: NotificationFilter }) {
  const m = useAdminMessages()
  const t = m.notifications
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const filtered = !!(filter.businessId || filter.kind || filter.read)

  const show = (next: NotificationFilter) =>
    startTransition(() => {
      router.replace(`${pathname}${notificationQuery(next)}`, { scroll: false })
    })

  const when = (row: AdminNotification) =>
    new Intl.DateTimeFormat(m.locale, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: row.timezone,
    }).format(new Date(row.at))

  const what = (row: AdminNotification) =>
    row.data.customerName ??
    row.data.customerPhone ??
    (row.data.sent !== undefined && row.data.limit !== undefined
      ? `${row.data.sent} / ${row.data.limit}`
      : undefined)

  return (
    <AdminPage
      title={m.nav.notifications}
      icon={<BellIcon />}
      empty={rows.length === 0 && !filtered && choices.length === 0 ? t.none : null}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:flex">
          <FilterSelect
            label={t.businessFilter}
            value={filter.businessId}
            items={[
              { value: ANY, label: t.allBusinesses },
              ...businesses.map(({ id, name }) => ({ value: id, label: name })),
            ]}
            onChange={(businessId) => show({ ...filter, businessId })}
          />
          <FilterSelect
            label={t.kindFilter}
            value={filter.kind}
            items={[
              { value: ANY, label: t.allKinds },
              ...IN_APP_KINDS.map((kind) => ({ value: kind, label: t.kinds[kind] })),
            ]}
            onChange={(kind) => show({ ...filter, kind: kind as NotificationFilter["kind"] })}
          />
          <FilterSelect
            label={t.readFilter}
            value={filter.read}
            items={[
              { value: ANY, label: t.allStates },
              ...NOTIFICATION_READ_FILTERS.map((read) => ({ value: read, label: t[read] })),
            ]}
            onChange={(read) => show({ ...filter, read: read as NotificationFilter["read"] })}
          />
        </div>

        <div aria-busy={pending} className={cn("transition-opacity", pending && "opacity-60")}>
          {rows.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>{filtered ? t.noneFound : t.none}</EmptyTitle>
              </EmptyHeader>
              {filtered && (
                <EmptyContent>
                  <Button variant="outline" onClick={() => show({})}>
                    {t.clearFilters}
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <ItemGroup className="gap-2">
              {rows.map((row) => (
                <Item key={row.id} variant="outline" size="sm">
                  <ItemContent className="min-w-0">
                    <ItemTitle>{t.kinds[row.kind]}</ItemTitle>
                    <ItemDescription>
                      {[row.businessName, what(row), when(row)].filter(Boolean).join(" · ")}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant={row.read ? "outline" : "secondary"}>
                      {row.read ? t.read : t.unread}
                    </Badge>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </div>

        {choices.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{t.turnedOff}</h2>
            <ItemGroup className="gap-2">
              {choices.map((choice) => (
                <Item key={choice.businessId} variant="outline" size="sm">
                  <ItemContent className="min-w-0">
                    <ItemTitle>{choice.businessName}</ItemTitle>
                    <div className="flex flex-wrap gap-1">
                      {choice.turnedOff.map((kind) => (
                        <Badge key={kind} variant="outline">
                          {t.kinds[kind]}
                        </Badge>
                      ))}
                    </div>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          </section>
        )}
      </div>
    </AdminPage>
  )
}

// One filter: "any" clears it.
function FilterSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string
  value: string | undefined
  items: { value: string; label: string }[]
  onChange: (value: string | undefined) => void
}) {
  return (
    <Select
      items={items}
      value={value ?? ANY}
      onValueChange={(next) => onChange(next === ANY || next === null ? undefined : String(next))}
    >
      <SelectTrigger className="w-full md:w-auto" aria-label={label}>
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
  )
}
