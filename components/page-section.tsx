import { cn } from "@/lib/utils"

// A titled part of the page that the section tabs scroll to. `sticky`: the
// title stays under the app's top bar while its part scrolls by, and the
// next part's title pushes it away (as iPhone lists do).
export function PageSection({
  id,
  title,
  action,
  sticky = false,
  className,
  children,
}: {
  id: string
  title: string
  action?: React.ReactNode
  sticky?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("flex scroll-mt-16 flex-col gap-4", className)}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2",
          // Just under the 56px top bar (and the notch), over the rows.
          sticky &&
            "sticky top-[calc(--spacing(14)+env(safe-area-inset-top))] z-20 -my-2 bg-background py-2"
        )}
      >
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
