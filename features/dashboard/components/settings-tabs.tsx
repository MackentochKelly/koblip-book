"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { Route } from "next"

import { ViewTabs } from "@/components/view-tabs"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"
import { SETTINGS_TABS } from "../navigation"

const TABS = SETTINGS_TABS.map(({ path, key }) => ({ id: path, key }))

type TabPath = (typeof SETTINGS_TABS)[number]["path"]

// Settings opens Team, Hours and Details as tabs, like an iPhone's segmented
// control, from both the menu and the phone's tab bar.
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
      listClassName="w-full"
    />
  )
}
