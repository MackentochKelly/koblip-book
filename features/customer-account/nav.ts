import {
  CalendarDaysIcon,
  GiftIcon,
  SettingsIcon,
  StoreIcon,
  UserIcon,
} from "@/components/ui/icons"
import {
  ACCOUNT_PLACES_PATH,
  ACCOUNT_PROFILE_PATH,
  ACCOUNT_REWARDS_PATH,
  ACCOUNT_SETTINGS_PATH,
  MY_BOOKINGS_PATH,
} from "@/lib/my-bookings-links"

// The client account's menu, in order (docs/plans/client-account.md, D2).
// A new client page is one entry here, its words in public.account.nav and
// its page under app/(customer)/account.
export const ACCOUNT_NAV = [
  { href: MY_BOOKINGS_PATH, key: "bookings", icon: CalendarDaysIcon },
  { href: ACCOUNT_PLACES_PATH, key: "places", icon: StoreIcon },
  { href: ACCOUNT_REWARDS_PATH, key: "rewards", icon: GiftIcon },
  { href: ACCOUNT_PROFILE_PATH, key: "profile", icon: UserIcon },
  { href: ACCOUNT_SETTINGS_PATH, key: "settings", icon: SettingsIcon },
] as const
