import {
  ClockIcon,
  ContactIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  ScissorsIcon,
  SettingsIcon,
  StoreIcon,
  UsersIcon,
} from "@/components/ui/icons"

// The owner area's pages, in the menu's groups (like Koblip Sales'
// config/navigation). The ☰ menu and the search list both read it; a new
// page goes in a group here. Paths follow /dashboard/[businessId]; `under`
// lists the paths that count as that page (Settings' tabs).
export const NAV_GROUPS = [
  {
    key: "bookings",
    items: [
      { path: "", key: "home", icon: LayoutDashboardIcon },
      { path: "/customers", key: "customers", icon: ContactIcon },
      { path: "/services", key: "services", icon: ScissorsIcon },
      { path: "/assistant", key: "assistant", icon: MessageCircleIcon },
    ],
  },
  {
    key: "workspace",
    items: [
      {
        // Opens on its first tab, Team.
        path: "/team",
        key: "settings",
        icon: SettingsIcon,
        under: ["/team", "/hours", "/settings"] as const,
      },
    ],
  },
] as const

// Settings' tabs, in order: the pages its menu entry opens.
export const SETTINGS_TABS = [
  { path: "/team", key: "team", icon: UsersIcon },
  { path: "/hours", key: "hours", icon: ClockIcon },
  { path: "/settings", key: "details", icon: StoreIcon },
] as const
