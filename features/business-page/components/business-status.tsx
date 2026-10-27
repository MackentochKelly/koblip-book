import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Open now or closed now, from the business's own hours.
export function BusinessStatus({ open }: { open: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(open && "border-success/20 bg-success/10 text-success")}
    >
      {open ? "Open now" : "Closed now"}
    </Badge>
  )
}
