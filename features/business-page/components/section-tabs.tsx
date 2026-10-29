"use client"

import { useEffect, useRef, useState } from "react"

import { useMessages } from "@/components/language-provider"
import { ViewTabs, type ViewTab } from "@/components/view-tabs"
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
  const [active, setActive] = useState<string | null>(null)
  const key = sections.map((section) => section.id).join(",")

  useEffect(() => {
    const ids = key.split(",")
    const update = () => {
      const element = ref.current
      if (element) {
        setPinned(
          window.scrollY > 0 && element.getBoundingClientRect().top <= 1
        )
      }
      let current: string | null = null
      for (const id of ids) {
        const section = document.getElementById(id)
        if (section && section.getBoundingClientRect().top <= ACTIVE_LINE)
          current = id
      }
      // At the very end the last section may never reach the line: it is the one in view.
      const page = document.documentElement
      if (
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >= page.scrollHeight - 2
      ) {
        current = ids.at(-1) ?? current
      }
      setActive(current)
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
          "-mx-4 bg-background pt-[max(--spacing(2),env(safe-area-inset-top))] md:mx-0",
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
