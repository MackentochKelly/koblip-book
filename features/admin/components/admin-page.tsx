import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// One admin page: its title, then its list, or `empty` when there is
// nothing yet (with the page's icon).
export function AdminPage({
  title,
  icon,
  empty,
  children,
}: {
  title: string
  icon: React.ReactNode
  empty: string | null
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {empty ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">{icon}</EmptyMedia>
            <EmptyTitle>{empty}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        children
      )}
    </div>
  )
}
