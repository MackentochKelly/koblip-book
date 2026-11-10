import {
  CalendarDaysIcon,
  ChartColumnIcon,
  ContactIcon,
  GiftIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  PuzzleIcon,
  SettingsIcon,
  SparklesIcon,
  TagIcon,
  UsersIcon,
  ZapIcon,
} from "@/components/ui/icons"
import type { PlanFeatureKey } from "@/lib/plan-features"

// The owner area's pages, in the menu's groups (like Koblip Sales'
// config/navigation). The ☰ menu and the search list both read it; a new
// page goes in a group here. Paths follow /dashboard/[businessId].
// The assistant stays listed for search and the top bar's title, but not in
// the ☰ menu: its own round button opens it (dashboard-shell.tsx).
export const NOT_IN_MENU: readonly string[] = ["assistant"]

export const NAV_GROUPS = [
  // What the owner opens every day: first, with no title.
  {
    key: "main",
    items: [
      { path: "", key: "home", icon: LayoutDashboardIcon },
      { path: "/bookings", key: "bookings", icon: CalendarDaysIcon },
      { path: "/analytics", key: "analytics", icon: ChartColumnIcon, feature: "analytics" },
      { path: "/customers", key: "customers", icon: ContactIcon },
      { path: "/assistant", key: "assistant", icon: SparklesIcon, feature: "assistantChat" },
    ],
  },
  // Set once, changed now and then.
  {
    key: "business",
    items: [
      { path: "/services", key: "services", icon: TagIcon },
      { path: "/team", key: "team", icon: UsersIcon },
      { path: "/automations", key: "automations", icon: ZapIcon },
      { path: "/rewards", key: "rewards", icon: GiftIcon, feature: "rewards" },
    ],
  },
  {
    key: "workspace",
    items: [
      { path: "/widgets", key: "widgets", icon: LayoutGridIcon, feature: "widgets" },
      { path: "/integrations", key: "integrations", icon: PuzzleIcon },
      { path: "/settings", key: "settings", icon: SettingsIcon },
    ],
  },
] as const

// The plan feature a menu page needs, for its plan badge when the
// business's plan doesn't have it (docs/plans/subscriptions.md, P5b).
export function navFeature(item: NavItem): PlanFeatureKey | undefined {
  return "feature" in item ? item.feature : undefined
}

// The page a path is on, for the top bar's title: the menu page whose path
// starts it (the longest one, so Home only matches itself). Sub-pages, like
// Settings' tabs, take their menu page's name.
type NavItem = (typeof NAV_GROUPS)[number]["items"][number]

export function navKeyFor(pathname: string, base: string) {
  const items = NAV_GROUPS.flatMap((group): readonly NavItem[] => group.items)
  const found = items
    .filter((item) =>
      item.path ? pathname.startsWith(base + item.path) : pathname === base
    )
    .sort((a, b) => b.path.length - a.path.length)[0]
  return found?.key
}
