"use client"

import { useCallback, useState } from "react"

// An element's height in px, kept current as its content changes (e.g. to
// animate a box to its content's size). Returns [ref callback, height]: put
// the callback on the element; the height is null until it is measured.
export function useElementHeight() {
  const [height, setHeight] = useState<number | null>(null)
  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.borderBoxSize[0].blockSize)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, height] as const
}
