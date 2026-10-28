import {
  ClockIcon,
  ContactIcon,
  HouseIcon,
  MessageCircleIcon,
  ScissorsIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/ui/icons"

// The owner area's pages, in the menu's groups (like Koblip Sales'
// config/navigation). The ☰ menu and the search list both read it; a new
// page goes in a group here. Paths follow /dashboard/[businessId].
export const NAV_GROUPS = [
  {
    key: "bookings",
    items: [
      { path: "", key: "home", icon: HouseIcon },
      { path: "/customers", key: "customers", icon: ContactIcon },
      { path: "/services", key: "services", icon: ScissorsIcon },
      { path: "/team", key: "team", icon: UsersIcon },
      { path: "/hours", key: "hours", icon: ClockIcon },
      { path: "/assistant", key: "assistant", icon: MessageCircleIcon },
    ],
  },
  {
    key: "workspace",
    items: [{ path: "/settings", key: "settings", icon: SettingsIcon }],
  },
] as const
