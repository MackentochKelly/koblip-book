import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// One admin page: its title, with the page's one action if it has one, then
// its list, or `empty` when there is nothing yet (with the page's icon).
export function AdminPage({
  title,
  icon,
  empty,
  action,
  children,
}: {
  title: string
  icon: React.ReactNode
  empty: string | null
  action?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {action}
      </div>
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
