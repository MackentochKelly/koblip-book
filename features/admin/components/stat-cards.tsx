import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Counts as cards: two across on a phone, up to four on a computer.
export function StatCards({
  stats,
  locale,
}: {
  stats: { label: string; value: number }[]
  locale: string
}) {
  const number = new Intl.NumberFormat(locale)
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
