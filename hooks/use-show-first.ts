"use client"

import { useState } from "react"

// A long list shows its first `limit` items until "Show more" shows the
// rest. `hidden` counts what is still folded away.
export function useShowFirst<T>(items: T[], limit: number) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, limit)
  return {
    shown,
    hidden: items.length - shown.length,
    showAll: () => setAll(true),
  }
}
