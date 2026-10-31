"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  BadgeCheckIcon,
  BanknoteIcon,
  BellIcon,
  CalendarDaysIcon,
  CalendarX2Icon,
  CircleAlertIcon,
  CircleCheckIcon,
  LinkIcon,
  MessageCircleIcon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "@/components/ui/icons"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { formatAgo } from "@/lib/format-ago"
import type { InAppKind } from "@/types/in-app-notifications"
import { groupByDay, titleOf } from "../utils/notification-view"
import { useNotifications } from "./notifications-provider"

const KIND_ICONS: Record<InAppKind, React.ComponentType> = {
  newBooking: CalendarDaysIcon,
  customerConfirmed: CircleCheckIcon,
  customerCantCome: CircleAlertIcon,
  customerCancelled: CalendarX2Icon,
  customerReplied: MessageCircleIcon,
  messageFailed: TriangleAlertIcon,
  templateApproved: BadgeCheckIcon,
  templateRejected: OctagonXIcon,
  koblipLimitNear: BanknoteIcon,
  koblipLimitReached: OctagonXIcon,
  connectionRenew: LinkIcon,
}

// The clock the "time ago" lines read, moved on every minute while the list
// is open.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

// The bell's list, the same in the computer's popover and the phone's sheet:
// Today, then Earlier, newest first. Tapping one marks it read and opens it.
export function NotificationList({ onOpen }: { onOpen: () => void }) {
  const {
    t,
    items,
    loaded,
    failed,
    nextCursor,
    loadingMore,
    reload,
    loadMore,
    markRead,
  } = useNotifications()
  const now = useNow()

  if (!loaded) {
    if (failed) {
      return (
        <Empty className="p-6">
          <EmptyHeader>
            <EmptyTitle>{t.failed}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={reload}>
              {t.retry}
            </Button>
          </EmptyContent>
        </Empty>
      )
    }
    return (
      <div className="flex justify-center p-6">
        <Spinner />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Empty className="p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BellIcon />
          </EmptyMedia>
          <EmptyTitle>{t.empty}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {groupByDay(items, now).map((group) => (
        <section
          key={group.id}
          aria-labelledby={`notifications-${group.id}`}
          className="flex flex-col gap-1"
        >
          <h3
            id={`notifications-${group.id}`}
            className="px-3 text-xs font-medium text-muted-foreground"
          >
            {t[group.id]}
          </h3>
          <ItemGroup className="gap-1">
            {group.items.map((item) => {
              const KindIcon = KIND_ICONS[item.kind]
              return (
                <Item
                  key={item.id}
                  role="listitem"
                  size="xs"
                  render={
                    <Link
                      href={item.link}
                      onClick={() => {
                        markRead(item.id)
                        onOpen()
                      }}
                    />
                  }
                  className="min-h-11"
                >
                  <ItemMedia variant="icon" className="text-muted-foreground">
                    <KindIcon />
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle
                      className={item.read ? "font-normal" : undefined}
                    >
                      {titleOf(item, t)}
                    </ItemTitle>
                    <ItemDescription className="line-clamp-1">
                      {item.businessName} · {formatAgo(item.at, now, t.locale)}
                    </ItemDescription>
                  </ItemContent>
                  {!item.read && (
                    <span className="size-2 shrink-0 rounded-full bg-primary">
                      <span className="sr-only">{t.unread}</span>
                    </span>
                  )}
                </Item>
              )
            })}
          </ItemGroup>
        </section>
      ))}
      {nextCursor && (
        <Button
          variant="ghost"
          className="w-full"
          disabled={loadingMore}
          onClick={loadMore}
        >
          {loadingMore && <Spinner data-icon="inline-start" />}
          {t.more}
        </Button>
      )}
    </div>
  )
}
