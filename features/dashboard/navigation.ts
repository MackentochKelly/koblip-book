import {
  ContactIcon,
  LayoutDashboardIcon,
  PuzzleIcon,
  SettingsIcon,
  SparklesIcon,
  TagIcon,
  UsersIcon,
  ZapIcon,
} from "@/components/ui/icons"

// The owner area's pages, in the menu's groups (like Koblip Sales'
// config/navigation). The ☰ menu and the search list both read it; a new
// page goes in a group here. Paths follow /dashboard/[businessId].
export const NAV_GROUPS = [
  // What the owner opens every day: first, with no title.
  {
    key: "main",
    items: [
      { path: "", key: "home", icon: LayoutDashboardIcon },
      { path: "/customers", key: "customers", icon: ContactIcon },
      { path: "/assistant", key: "assistant", icon: SparklesIcon },
    ],
  },
  // Set once, changed now and then.
  {
    key: "business",
    items: [
      { path: "/services", key: "services", icon: TagIcon },
      { path: "/team", key: "team", icon: UsersIcon },
      { path: "/automations", key: "automations", icon: ZapIcon },
    ],
  },
  {
    key: "workspace",
    items: [
      { path: "/integrations", key: "integrations", icon: PuzzleIcon },
      { path: "/settings", key: "settings", icon: SettingsIcon },
    ],
  },
] as const

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
