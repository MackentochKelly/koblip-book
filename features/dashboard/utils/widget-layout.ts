import { WIDGETS, type WidgetId, type WidgetLayout } from "../widgets"

const IDS = new Set<string>(WIDGETS.map((widget) => widget.id))

function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === "string" && IDS.has(value)
}

// What a new business starts with.
export const DEFAULT_LAYOUT: WidgetLayout = {
  order: WIDGETS.map((widget) => widget.id),
  hidden: WIDGETS.filter((widget) => !widget.shown).map((widget) => widget.id),
}

// Any saved value (the database, a cookie, a request) made into a layout we
// can trust: unknown or repeated widgets dropped, and a widget added to the
// app since it was saved put at the end, shown or not as it starts.
export function normalizeLayout(value: unknown): WidgetLayout {
  if (typeof value !== "object" || value === null) return DEFAULT_LAYOUT
  const raw = value as { order?: unknown; hidden?: unknown }
  if (!Array.isArray(raw.order) || !Array.isArray(raw.hidden)) {
    return DEFAULT_LAYOUT
  }
  const saved = [...new Set(raw.order.filter(isWidgetId))]
  const added = DEFAULT_LAYOUT.order.filter((id) => !saved.includes(id))
  const hidden = new Set(raw.hidden.filter(isWidgetId))
  return {
    order: [...saved, ...added],
    hidden: [
      ...saved.filter((id) => hidden.has(id)),
      ...added.filter((id) => DEFAULT_LAYOUT.hidden.includes(id)),
    ],
  }
}

// The widgets Home shows, in order.
export function shownWidgets(layout: WidgetLayout): WidgetId[] {
  return layout.order.filter((id) => !layout.hidden.includes(id))
}

// Home's shown widgets in a new order, put back into their places in the
// full order (taken-off widgets stay where they were).
export function reorderShown(
  layout: WidgetLayout,
  shown: WidgetId[]
): WidgetLayout {
  let next = 0
  return {
    ...layout,
    order: layout.order.map((id) =>
      layout.hidden.includes(id) ? id : shown[next++]
    ),
  }
}

// The layout with one widget taken off Home, or put back.
export function setShown(
  layout: WidgetLayout,
  id: WidgetId,
  shown: boolean
): WidgetLayout {
  const hidden = layout.hidden.filter((other) => other !== id)
  return { ...layout, hidden: shown ? hidden : [...hidden, id] }
}
