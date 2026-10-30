import {
  BanknoteIcon,
  CalendarDaysIcon,
  ClockIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  PhoneIcon,
  SettingsIcon,
  SquarePenIcon,
  StoreIcon,
} from "@/components/ui/icons"

export const WHATSAPP_BASE = "/admin/whatsapp"

// The admin's WhatsApp parts, in order (docs/plans/whatsapp-notifications.md,
// "Nothing hidden"). Overview is the page itself; each other part is its own
// route below it (app/(admin)/admin/whatsapp/).
export const WHATSAPP_PARTS = [
  { id: "overview", icon: LayoutDashboardIcon },
  { id: "koblip-number", icon: PhoneIcon },
  { id: "koblip-messages", icon: MessageCircleIcon },
  { id: "businesses", icon: StoreIcon },
  { id: "activity", icon: CalendarDaysIcon },
  { id: "window", icon: ClockIcon },
  { id: "rules", icon: SettingsIcon },
  { id: "usage", icon: BanknoteIcon },
  { id: "changes", icon: SquarePenIcon },
] as const

export type WhatsappPart = (typeof WHATSAPP_PARTS)[number]["id"]
