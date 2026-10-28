"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { Route } from "next"

import { ViewTabs } from "@/components/view-tabs"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"

const TABS = [
  { id: "/team", key: "team" },
  { id: "/hours", key: "hours" },
  { id: "/settings", key: "details" },
] as const

type TabPath = (typeof TABS)[number]["id"]

// On a phone the tab bar has no room for Team and Hours, so Settings opens
// them as tabs, like an iPhone's segmented control. The computer's sidebar
// lists them itself.
export function SettingsTabs({ businessId }: { businessId: string }) {
  const router = useRouter()
  const m = useOwnerMessages().shell.nav
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
      views={TABS.map(({ id, key }) => ({ id, label: m[key] }))}
      value={value}
      onChange={(id) => router.push(`${base}${id}` as Route)}
      ariaLabel={m.settings}
      className="md:hidden"
      listClassName="w-full"
    />
  )
}
