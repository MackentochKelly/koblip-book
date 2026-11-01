import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Under a catalog list: Load more, then the phone's Suggest, close together
// and centred. Suggest is a phone's only (it hides itself on a computer),
// so without Load more the footer hides there too.
export function ListFooter({
  loadMore,
  suggest,
}: {
  loadMore: React.ReactNode
  suggest: React.ReactNode
}) {
  if (!loadMore && !suggest) return null
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3",
        !loadMore && "md:hidden"
      )}
    >
      {loadMore}
      {suggest}
    </div>
  )
}

export function LoadMore({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <Button variant="outline" onClick={onClick}>
      {label}
    </Button>
  )
}
