"use client"

import { useEffect, useRef, useState } from "react"

import { useMessages } from "@/components/language-provider"
import { ViewTabs, type ViewTab } from "@/components/view-tabs"
import { useScrollSpy } from "@/hooks/use-scroll-spy"
import { cn } from "@/lib/utils"

// Just under the pinned tabs, where a section heading lands when its tab is pressed.
const ACTIVE_LINE = 120

// The tabs take no room and stay hidden until the page scrolls into the
// sections; then they slide in pinned at the top (like Fresha), and leave at
// once. -mt-8 undoes the column gap, so no empty space is left where they sit.
export function SectionTabs({ sections }: { sections: ViewTab<string>[] }) {
  const m = useMessages()
  const ref = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(false)
  const ids = sections.map((section) => section.id)
  const active = useScrollSpy(ids, { line: ACTIVE_LINE })
  const key = ids.join(",")

  // Pinned once the page has scrolled them to the top.
  useEffect(() => {
    const update = () => {
      const element = ref.current
      if (element) {
        setPinned(
          window.scrollY > 0 && element.getBoundingClientRect().top <= 1
        )
      }
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [key])

  if (sections.length === 0) return null
  return (
    <div ref={ref} className="sticky top-0 z-10 -mt-8 h-0">
      <div
        inert={!pinned}
        className={cn(
          "-mx-4 bg-background pt-[max(--spacing(2),var(--safe-top))] md:mx-0",
          pinned
            ? "transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none"
            : "-translate-y-2 opacity-0"
        )}
      >
        <ViewTabs
          variant="line"
          listClassName="px-4 md:px-0"
          views={sections}
          value={active ?? sections[0].id}
          onChange={(id) =>
            document
              .getElementById(id)
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          ariaLabel={m.sections.pageSections}
        />
      </div>
    </div>
  )
}
