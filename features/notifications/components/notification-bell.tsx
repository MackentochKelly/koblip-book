"use client"

import Link from "next/link"
import { useState } from "react"

import { BottomPanel } from "@/components/bottom-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { BellIcon, CheckIcon, SettingsIcon } from "@/components/ui/icons"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"
import { NotificationList } from "./notification-list"
import { useNotifications } from "./notifications-provider"

// Marks every notification read; off when none is unread.
function MarkAllButton({ className }: { className?: string }) {
  const { t, unread, markAll } = useNotifications()
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      disabled={unread === 0}
      onClick={markAll}
    >
      <CheckIcon data-icon="inline-start" />
      {t.markAll}
    </Button>
  )
}

// The owner's choices screen (N7).
function SettingsButton({ onOpen }: { onOpen: () => void }) {
  const { t, settingsHref } = useNotifications()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t.settings}
      nativeButton={false}
      render={<Link href={settingsHref} onClick={onOpen} />}
    >
      <SettingsIcon />
    </Button>
  )
}

// The owner area's bell (docs/plans/in-app-notifications.md, N4): the
// unread count on it; a popover on a computer, a bottom sheet on a phone.
export function NotificationBell() {
  const { t, unread } = useNotifications()
  const phone = useIsMobile()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const label = unread > 0 ? t.bellUnread(unread) : t.bell

  const icon = (
    <>
      <BellIcon />
      {unread > 0 && (
        // A backdrop under the soft badge, so the bell doesn't show through.
        <span
          aria-hidden
          className="pointer-events-none absolute -top-0.5 -right-0.5 rounded-3xl bg-background"
        >
          <Badge
            variant="destructive"
            className="h-5 min-w-5 px-1.5 tabular-nums"
          >
            {unread > 9 ? "9+" : unread}
          </Badge>
        </span>
      )}
    </>
  )
  const buttonClass = "relative [&_svg:not([class*='size-'])]:size-5"

  if (phone) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          className={buttonClass}
          onClick={() => setOpen(true)}
        >
          {icon}
        </Button>
        <BottomPanel
          open={open}
          onClose={close}
          title={t.title}
          header={
            <DrawerHeader className="flex-row items-center justify-between gap-2">
              <DrawerTitle>{t.title}</DrawerTitle>
              <SettingsButton onOpen={close} />
            </DrawerHeader>
          }
          // Room for the longer Spanish label, under the thumb.
          footer={<MarkAllButton className="w-full" />}
        >
          <NotificationList onOpen={close} />
        </BottomPanel>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            className={buttonClass}
          />
        }
      >
        {icon}
      </PopoverTrigger>
      <PopoverContent
        // The bell sits at the top bar's right edge (N-D11).
        align="end"
        side="bottom"
        className="max-h-[min(--spacing(140),80dvh)] w-sm gap-2 overflow-y-auto p-2"
      >
        <PopoverHeader className="flex-row items-center justify-between gap-2 py-1 pl-3">
          <PopoverTitle>{t.title}</PopoverTitle>
          <div className="flex items-center gap-1">
            <MarkAllButton />
            <SettingsButton onOpen={close} />
          </div>
        </PopoverHeader>
        <NotificationList onOpen={close} />
      </PopoverContent>
    </Popover>
  )
}
