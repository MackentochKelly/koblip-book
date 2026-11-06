import { cn } from "@/lib/utils"

// A titled part of the page that the section tabs scroll to. The title is
// Apple's section title: big and bold above its cards, an action (View all)
// at its right.
export function PageSection({
  id,
  title,
  action,
  className,
  children,
}: {
  id: string
  title: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("flex scroll-mt-16 flex-col gap-4", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="text-xl font-bold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
