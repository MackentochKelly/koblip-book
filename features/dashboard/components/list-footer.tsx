import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Under a catalog list: Show more, then the phone's Suggest, close
// together and centred. Suggest is a phone's only (it hides itself on a
// computer), so without Show more the footer hides there too.
export function ListFooter({
  showMore,
  suggest,
}: {
  showMore: React.ReactNode
  suggest: React.ReactNode
}) {
  if (!showMore && !suggest) return null
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3",
        !showMore && "md:hidden"
      )}
    >
      {showMore}
      {suggest}
    </div>
  )
}

export function ShowMore({
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
