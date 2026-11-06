"use client"

import type { Announcements } from "@dnd-kit/core"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { saveWidgetLayout } from "../api/widget-actions"
import type { WidgetId, WidgetLayout } from "../widgets"

// Home's layout as the owner edits it: each change shows at once and is
// saved behind it (on this device or the account); a failed save puts the
// last layout back.
export function useWidgetLayout(
  businessId: string,
  saved: WidgetLayout,
  savedDevice: boolean
) {
  const t = useTranslations("owner.widgets")
  const [layout, setLayout] = useState(saved)
  const [device, setDevice] = useState(savedDevice)
  // A fresh layout from the server (another tab, a refresh) wins.
  const [seen, setSeen] = useState({ saved, savedDevice })
  if (seen.saved !== saved || seen.savedDevice !== savedDevice) {
    setSeen({ saved, savedDevice })
    setLayout(saved)
    setDevice(savedDevice)
  }
  const [pending, startSaving] = useTransition()

  function save(next: WidgetLayout, nextDevice = device) {
    const before = { layout, device }
    setLayout(next)
    setDevice(nextDevice)
    startSaving(async () => {
      const result = await saveWidgetLayout(businessId, next, nextDevice)
      if (!result.ok) {
        setLayout(before.layout)
        setDevice(before.device)
        toast.error(t("failed"))
      }
    })
  }

  return { layout, device, save, pending }
}

// What screen readers hear while a widget is moved, by its name and place.
export function useWidgetAnnouncements(): {
  announcements: Announcements
  instructions: string
} {
  const t = useTranslations("owner.widgets")
  const name = (id: string | number) => t(`names.${id as WidgetId}`)
  const place = (over: { data: { current?: Record<string, unknown> } } | null) => {
    const sortable = over?.data.current?.sortable as
      | { index: number; items: unknown[] }
      | undefined
    return sortable
      ? { position: sortable.index + 1, total: sortable.items.length }
      : null
  }
  return {
    instructions: t("instructions"),
    announcements: {
      onDragStart: ({ active }) => t("picked", { name: name(active.id) }),
      onDragOver: ({ active, over }) => {
        const at = place(over)
        return at ? t("movedTo", { name: name(active.id), ...at }) : undefined
      },
      onDragEnd: ({ active, over }) => {
        const at = place(over)
        return at ? t("dropped", { name: name(active.id), ...at }) : undefined
      },
      onDragCancel: ({ active }) => t("cancelled", { name: name(active.id) }),
    },
  }
}
