"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import {
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
} from "@/components/ui/icons"

import { AppShell } from "@/components/app-shell"
import { PhotoWordsProvider, type PhotoWords } from "@/components/photo-upload"

const NAV = [
  { path: "", key: "bookings", icon: CalendarDaysIcon },
  { path: "/hours", key: "hours", icon: ClockIcon },
  { path: "/profile", key: "profile", icon: UserIcon },
] as const

// A team member's own area (docs/plans/team-accounts.md), in the app's
// shared frame (AppShell): the menu beside the page on a computer, a tab
// bar on a phone, and the top bar with the open page's name.
export function TeamShell({
  teamMemberId,
  businessName,
  children,
}: {
  teamMemberId: string
  businessName: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const t = useTranslations("teamArea")
  const photos = useTranslations("teamArea.photos")
  // The photo buttons' words, one object while the words stay the same, so
  // the photo fields don't redraw on every page change.
  const photoWords = useMemo<PhotoWords>(
    () => ({
      change: photos("change"),
      addPhoto: photos("addPhoto"),
      remove: photos("remove"),
      errors: {
        not_found: photos("errors.not_found"),
        missing: photos("errors.missing"),
        too_big: photos("errors.too_big"),
        wrong_type: photos("errors.wrong_type"),
        limit: photos("errors.limit"),
      },
    }),
    [photos]
  )
  const base = `/team/${teamMemberId}`
  const items = NAV.map((item) => ({
    href: base + item.path,
    label: t(`nav.${item.key}`),
    icon: item.icon,
    active: item.path ? pathname.startsWith(base + item.path) : pathname === base,
  }))
  return (
    <AppShell title={businessName} items={items} menuLabel={t("menu")}>
      <PhotoWordsProvider words={photoWords}>{children}</PhotoWordsProvider>
    </AppShell>
  )
}
