"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export interface ViewTab<T extends string> {
  id: T
  label: string
}

// The app's one row of tabs. A row that runs out of room scrolls sideways
// with no bar and fades the edge where more tabs hide. `line`: plain words
// with a bar under the open one; the row draws the one line under it.
export function ViewTabs<T extends string>({
  views,
  value,
  onChange,
  ariaLabel,
  variant = "default",
  className,
  listClassName,
}: {
  views: ViewTab<T>[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  variant?: "default" | "line"
  className?: string
  listClassName?: string
}) {
  const line = variant === "line"
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className={cn("min-w-0 gap-1", line && "border-b", className)}
    >
      <div className="no-scrollbar min-w-0 flex-1 scroll-fade-x overflow-x-auto whitespace-nowrap">
        <TabsList
          variant={variant}
          aria-label={ariaLabel}
          className={cn(line && "min-w-full justify-start", listClassName)}
        >
          {views.map((view) => (
            <TabsTrigger key={view.id} value={view.id}>
              {view.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  )
}
