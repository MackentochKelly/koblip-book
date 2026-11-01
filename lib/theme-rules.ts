// Looks an owner can pick for their public page. Luma is today's look and
// the default; the others show as Coming soon until they are built.
export const THEMES = [
  { id: "luma", name: "Luma", available: true },
  { id: "vega", name: "Vega", available: false },
  { id: "nova", name: "Nova", available: false },
  { id: "maia", name: "Maia", available: false },
  { id: "lyra", name: "Lyra", available: false },
] as const

export type ThemeId = (typeof THEMES)[number]["id"]

export const DEFAULT_THEME: ThemeId = "luma"

// Only a built theme can be turned on.
export function isAvailableTheme(value: string): value is ThemeId {
  return THEMES.some((theme) => theme.id === value && theme.available)
}
