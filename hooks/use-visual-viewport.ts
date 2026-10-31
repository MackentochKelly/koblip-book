import { useEffect, useState } from "react"

interface VisibleArea {
  top: number
  height: number
}

// The part of the screen the visitor can see, above the phone keyboard.
// When the keyboard opens, iPhone Safari shrinks this area and slides it
// down the page, so a full-screen layer pinned to the screen would lose its
// top. Put `top` and `height` on a `fixed` layer to keep it in view.
// (developer.mozilla.org/docs/Web/API/VisualViewport)
export function useVisualViewport(active: boolean): VisibleArea | null {
  const [area, setArea] = useState<VisibleArea | null>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!active || !viewport) return
    const update = () =>
      setArea({ top: viewport.offsetTop, height: viewport.height })
    update()
    viewport.addEventListener("resize", update)
    viewport.addEventListener("scroll", update)
    return () => {
      viewport.removeEventListener("resize", update)
      viewport.removeEventListener("scroll", update)
      setArea(null)
    }
  }, [active])

  return active ? area : null
}

// How much of the bottom of the screen the browser's own bar covers, in px:
// iPhone Safari 26 floats its bar over the page and, after scrolling, can
// leave a bar pinned to the bottom under it. It is the part of the layout
// viewport below the visible one (0 when nothing covers it). While typing
// it stays 0, so a bottom bar doesn't ride up on the keyboard.
// (developer.mozilla.org/docs/Web/API/Visual_Viewport_API)
export function useCoveredBottom(): number {
  const [covered, setCovered] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => {
      const typing =
        document.activeElement instanceof HTMLElement &&
        document.activeElement.matches(
          "input, textarea, select, [contenteditable]:not([contenteditable='false'])"
        )
      const gap = Math.round(
        window.innerHeight - (viewport.height + viewport.offsetTop)
      )
      setCovered(typing ? 0 : Math.max(0, gap))
    }
    update()
    viewport.addEventListener("resize", update)
    viewport.addEventListener("scroll", update)
    window.addEventListener("scroll", update, { passive: true })
    document.addEventListener("focusin", update)
    document.addEventListener("focusout", update)
    return () => {
      viewport.removeEventListener("resize", update)
      viewport.removeEventListener("scroll", update)
      window.removeEventListener("scroll", update)
      document.removeEventListener("focusin", update)
      document.removeEventListener("focusout", update)
    }
  }, [])

  return covered
}
