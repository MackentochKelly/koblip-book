"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { Route } from "next"

import { ViewTabs } from "@/components/view-tabs"

const TABS = [
  { id: "/settings", label: "Details" },
  { id: "/team", label: "Team" },
  { id: "/hours", label: "Hours" },
] as const

type TabPath = (typeof TABS)[number]["id"]

// On a phone the tab bar has no room for Team and Hours, so Settings opens
// them as tabs, the same row as Bookings' Upcoming and Past. The computer's sidebar
// lists them itself.
export function SettingsTabs({ businessId }: { businessId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const base = `/dashboard/${businessId}`
  const value =
    TABS.find((tab) => pathname.startsWith(base + tab.id))?.id ?? "/settings"

  // Ready before the tap, so switching is instant.
  useEffect(() => {
    for (const tab of TABS) router.prefetch(`${base}${tab.id}` as Route)
  }, [router, base])

  return (
    <ViewTabs<TabPath>
      views={TABS.map(({ id, label }) => ({ id, label }))}
      value={value}
      onChange={(id) => router.push(`${base}${id}` as Route)}
      ariaLabel="Settings"
      variant="line"
      className="md:hidden"
    />
  )
}
