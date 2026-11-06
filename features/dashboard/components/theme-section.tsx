"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { PageSection } from "@/components/page-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PaletteIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { THEMES, type ThemeId } from "@/lib/theme-rules"
import { useOwnerMessages } from "../i18n/provider"
import { activateTheme } from "../api/theme-actions"

// The public page's looks: the active one, the others to turn on, and the
// ones still being built marked Coming soon.
export function ThemeSection({
  businessId,
  active,
}: {
  businessId: string
  active: ThemeId
}) {
  const m = useOwnerMessages()
  const t = m.settings.theme
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const activate = (theme: ThemeId) =>
    startTransition(async () => {
      const result = await activateTheme(businessId, theme).catch(() => null)
      if (result?.ok) {
        toast.success(t.activated)
        router.refresh()
      } else {
        toast.error(m.settings.tryAgain)
      }
    })

  return (
    <PageSection id="theme" title={t.title}>
      <ItemGroup>
        {THEMES.map((theme) => (
          <Item key={theme.id} variant="outline" role="listitem">
            <ItemMedia variant="icon">
              <PaletteIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{theme.name}</ItemTitle>
            </ItemContent>
            <ItemActions>
              {theme.id === active ? (
                <Badge variant="success">{t.active}</Badge>
              ) : theme.available ? (
                <Button onClick={() => activate(theme.id)} disabled={pending}>
                  {pending && <Spinner data-icon="inline-start" />}
                  {t.activate}
                </Button>
              ) : (
                <Badge variant="secondary">{t.comingSoon}</Badge>
              )}
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </PageSection>
  )
}
