import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AdminOverview } from "../api/queries"
import type { AdminMessages } from "../i18n"

// The four app-wide counts, two across on a phone, four on a computer.
export function OverviewCards({
  overview,
  m,
}: {
  overview: AdminOverview
  m: AdminMessages
}) {
  const number = new Intl.NumberFormat(m.locale)
  const stats = [
    { label: m.overview.businesses, value: overview.businesses },
    { label: m.overview.owners, value: overview.owners },
    { label: m.overview.bookings, value: overview.bookings },
    { label: m.overview.newOwners, value: overview.newOwners },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader>
            <CardDescription>{stat.label}</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {number.format(stat.value)}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
