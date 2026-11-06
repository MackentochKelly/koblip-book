"use client"

import { useEffect, useRef } from "react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CONTROL_SIZE } from "@/lib/control-size"
import { cn } from "@/lib/utils"

export interface ViewTab<T extends string> {
  id: T
  label: string
  icon?: React.ReactNode
}

// The app's one row of tabs. A row that runs out of room scrolls sideways
// with no bar and fades the edge where more tabs hide. `line`: plain words
// with a bar under the open one; the row draws the one line under it.
// Each tab is a filter chip's size, with a 44px tap area on a touch screen
// (lib/control-size).
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
  // Like big apps: the open tab slides into the middle of the row, so a tab
  // opened by scrolling the page is never hidden or faded at the edge.
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = row.current
    const tab = box?.querySelector<HTMLElement>("[data-active]")
    if (!box || !tab) return
    const boxRect = box.getBoundingClientRect()
    const tabRect = tab.getBoundingClientRect()
    const left =
      box.scrollLeft +
      tabRect.left -
      boxRect.left -
      (boxRect.width - tabRect.width) / 2
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    box.scrollTo({ left, behavior: reduce ? "auto" : "smooth" })
  }, [value])
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className={cn("min-w-0 gap-1", line && "border-b", className)}
    >
      {/* The side scroll also clips up and down, so the row gets room for
          the 44px tap areas (padding, taken back by a negative margin). */}
      <div
        ref={row}
        className="-my-1.5 no-scrollbar min-w-0 flex-1 scroll-fade-x overflow-x-auto py-1.5 whitespace-nowrap"
      >
        <TabsList
          variant={variant}
          aria-label={ariaLabel}
          className={cn(
            line ? "min-w-full justify-start" : CONTROL_SIZE.tabsList,
            listClassName
          )}
        >
          {views.map((view) => (
            <TabsTrigger
              key={view.id}
              value={view.id}
              className={CONTROL_SIZE.tab}
            >
              {view.icon}
              {view.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  )
}
