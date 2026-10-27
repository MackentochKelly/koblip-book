import { cn } from "@/lib/utils"

export function PageSection({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}
