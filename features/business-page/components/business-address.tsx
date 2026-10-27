import { MapPinIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Where the business is, on a soft gray chip with a pin.
export function BusinessAddress({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "flex w-fit max-w-full min-w-0 items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm",
        className
      )}
    >
      <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </p>
  )
}
