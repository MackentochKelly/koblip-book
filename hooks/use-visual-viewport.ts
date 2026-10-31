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
