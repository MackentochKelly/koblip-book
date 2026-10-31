import type { AdminOverview } from "../api/queries"
import type { AdminMessages } from "../i18n"
import { StatCards } from "@/components/stat-cards"

// The four app-wide counts.
export function OverviewCards({
  overview,
  m,
}: {
  overview: AdminOverview
  m: AdminMessages
}) {
  return (
    <StatCards
      locale={m.locale}
      stats={[
        { label: m.overview.businesses, value: overview.businesses },
        { label: m.overview.owners, value: overview.owners },
        { label: m.overview.bookings, value: overview.bookings },
        { label: m.overview.newOwners, value: overview.newOwners },
      ]}
    />
  )
}
