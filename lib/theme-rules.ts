// Looks an owner can pick for their business: its dashboard, its team's area
// and its public page all wear it (components/business-theme.tsx; each
// look's colours, corners and fonts are in app/globals.css). Luma is the
// default; the ones not built yet show as Coming soon. Light and dark are a
// separate choice, the visitor's own, and every look has both.
export const THEMES = [
  { id: "luma", name: "Luma", available: true },
  { id: "vega", name: "Vega", available: false },
  { id: "nova", name: "Nova", available: true },
  { id: "maia", name: "Maia", available: false },
  { id: "lyra", name: "Lyra", available: false },
] as const

export type ThemeId = (typeof THEMES)[number]["id"]

export const DEFAULT_THEME: ThemeId = "luma"

// Only a built theme can be turned on.
export function isAvailableTheme(value: string): value is ThemeId {
  return THEMES.some((theme) => theme.id === value && theme.available)
}
