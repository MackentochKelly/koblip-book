import "server-only"
import { cache } from "react"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import { DEFAULT_THEME, isAvailableTheme, type ThemeId } from "@/lib/theme-rules"

// A saved look that is no longer built falls back to the default one.
function builtTheme(theme: string | undefined): ThemeId {
  return theme && isAvailableTheme(theme) ? theme : DEFAULT_THEME
}

// The look a business picked (Settings → Theme), for the pages that are that
// business's: its public page and its team's area.
export const getBusinessThemeBySlug = cache(async (slug: string) => {
  const [row] = await db
    .select({ theme: businesses.theme })
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1)
  return builtTheme(row?.theme)
})

export const getBusinessThemeById = cache(async (id: string) => {
  const [row] = await db
    .select({ theme: businesses.theme })
    .from(businesses)
    .where(eq(businesses.id, id))
    .limit(1)
  return builtTheme(row?.theme)
})
