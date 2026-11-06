"use client"

import { useEffect, useEffectEvent, useState, type RefObject } from "react"

// The nearest box around an element that scrolls up and down (a sheet's
// list), or null when it is the page itself that scrolls.
export function scrollParent(element: Element | null): HTMLElement | null {
  for (
    let node = element?.parentElement ?? null;
    node && node !== document.body && node !== document.documentElement;
    node = node.parentElement
  ) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === "auto" || overflowY === "scroll") return node
  }
  return null
}

// Which section (by element id) is in view, for tabs that follow the
// scroll: the last one whose top has passed `line` (px from the top of the
// screen), or the last one once the scroll reaches the very end, since it
// may never reach the line. Null before the first one is reached. It
// follows the page, or with `inside`, the box that scrolls around that
// element (a sheet).
export function useScrollSpy(
  ids: readonly string[],
  {
    line,
    inside,
  }: {
    line: number | (() => number)
    inside?: RefObject<HTMLElement | null>
  }
): string | null {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join(",")

  const update = useEffectEvent((box: HTMLElement | null) => {
    const at = typeof line === "number" ? line : line()
    const sections = key.split(",")
    let current: string | null = null
    for (const id of sections) {
      const section = document.getElementById(id)
      if (section && section.getBoundingClientRect().top <= at) current = id
    }
    const atEnd = box
      ? box.scrollTop > 0 &&
        box.scrollTop + box.clientHeight >= box.scrollHeight - 2
      : window.scrollY > 0 &&
        window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 2
    if (atEnd) current = sections.at(-1) ?? current
    setActive(current)
  })

  useEffect(() => {
    if (!key) return
    const box = inside ? scrollParent(inside.current) : null
    const scroller = box ?? window
    const onScroll = () => update(box)
    onScroll()
    scroller.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      scroller.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [key, inside])

  return key ? active : null
}
