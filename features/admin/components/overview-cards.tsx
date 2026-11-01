import type { AdminOverview } from "../api/queries"
import type { AdminMessages } from "../i18n"
import { StatStrip } from "@/components/stat-strip"
import {
  CalendarIcon,
  SparklesIcon,
  StoreIcon,
  UsersIcon,
} from "@/components/ui/icons"

// The four app-wide counts.
export function OverviewCards({
  overview,
  m,
}: {
  overview: AdminOverview
  m: AdminMessages
}) {
  const number = new Intl.NumberFormat(m.locale)
  return (
    <StatStrip
      stats={[
        {
          icon: <StoreIcon />,
          tone: "primary",
          label: m.overview.businesses,
          value: number.format(overview.businesses),
        },
        {
          icon: <UsersIcon />,
          tone: "info",
          label: m.overview.owners,
          value: number.format(overview.owners),
        },
        {
          icon: <CalendarIcon />,
          tone: "success",
          label: m.overview.bookings,
          value: number.format(overview.bookings),
        },
        {
          icon: <SparklesIcon />,
          tone: "warning",
          label: m.overview.newOwners,
          value: number.format(overview.newOwners),
        },
      ]}
    />
  )
}
