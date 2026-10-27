import { cn } from "@/lib/utils"

// A phone page's main buttons, pinned to the bottom on the page colour, clear
// of the phone's home line.
export function BottomBar({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      role="region"
      aria-label={label}
      className={cn("fixed inset-x-0 bottom-0 z-40 transform-gpu", className)}
    >
      <div className="flex gap-2 border-t bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  )
}
