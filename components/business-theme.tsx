import type { ThemeId } from "@/lib/theme-rules"

// Marks the page as one business's: app/globals.css gives the whole page
// (menus, dialogs and sheets too) that business's look while this is on it.
// Put it once in a business's layout. It draws nothing, and the look goes
// with it when the visitor leaves for another business.
export function BusinessTheme({ theme }: { theme: ThemeId }) {
  return <div hidden data-business-theme={theme} />
}

// Shows the page in another look for as long as this is on it, without
// saving anything (Settings → Theme → Preview). It wins over BusinessTheme.
export function ThemePreview({ theme }: { theme: ThemeId }) {
  return <div hidden data-preview-theme={theme} />
}
