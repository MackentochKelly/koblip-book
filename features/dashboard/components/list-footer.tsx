import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Under a catalog list: Show more, then the phone's Suggest and its other
// add button (Services' Add category), close together and centred. Suggest
// and add are a phone's only (they hide themselves on a computer), so
// without Show more the footer hides there too.
export function ListFooter({
  showMore,
  suggest,
  add,
}: {
  showMore: React.ReactNode
  suggest: React.ReactNode
  add?: React.ReactNode
}) {
  if (!showMore && !suggest && !add) return null
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3",
        !showMore && "md:hidden"
      )}
    >
      {showMore}
      {suggest}
      {add}
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
