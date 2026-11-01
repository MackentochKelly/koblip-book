import {
  CalendarDaysIcon,
  ChartColumnIcon,
  ClockIcon,
  ContactIcon,
  ShareIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "@/components/ui/icons"

// Every widget the owner can put on Home, in its first order. The Widgets
// page and Home both read it; a new widget goes here (with its words in
// i18n/<lang>/widgets.ts names and its part in Home). `shown` is
// whether a new business starts with it on Home.
export const WIDGETS = [
  { id: "stats", icon: TrendingUpIcon, shown: true },
  { id: "today", icon: SparklesIcon, shown: true },
  { id: "bookings", icon: CalendarDaysIcon, shown: true },
  { id: "next", icon: ClockIcon, shown: false },
  { id: "chart", icon: ChartColumnIcon, shown: false },
  { id: "newCustomers", icon: ContactIcon, shown: false },
  { id: "share", icon: ShareIcon, shown: false },
] as const

export type WidgetId = (typeof WIDGETS)[number]["id"]

// Home's widgets: every widget in the owner's order, and the ones taken off.
// A widget taken off keeps its place, so putting it back puts it where it was.
export interface WidgetLayout {
  order: WidgetId[]
  hidden: WidgetId[]
}

// Where the layout lives: the owner's account (every device), or a cookie
// on this device only.
export const WIDGETS_COOKIE_PREFIX = "widgets-"
export const WIDGETS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// How many rows a list widget (New customers) shows, on a phone and a
// computer alike.
export const WIDGET_LIST_LIMIT = 4
