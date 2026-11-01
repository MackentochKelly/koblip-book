import { cn } from "@/lib/utils"

// A page form's buttons (Save and the like): full width on a phone, where
// the thumb reaches them; on a computer they keep their own width and line
// up with the fields' left edge, never stretched across the page.
// Panels and sheets keep their own full-width footer.
export function FormActions({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn("flex flex-col gap-2 md:flex-row md:items-center", className)}
    >
      {children}
    </div>
  )
}
