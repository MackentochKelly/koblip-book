"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { ThemePreview } from "@/components/business-theme"
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
import { activateTheme } from "../api/theme-actions"

// The business's looks: the active one, the others to try (Preview shows
// this screen in that look, saving nothing, until it is stopped or the owner
// leaves) or turn on, and the ones still being built marked Coming soon.
export function ThemeSection({
  businessId,
  active,
}: {
  businessId: string
  active: ThemeId
}) {
  const settings = useTranslations("owner.settings")
  const t = useTranslations("owner.settings.theme")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [preview, setPreview] = useState<ThemeId | null>(null)
  const activate = (theme: ThemeId) =>
    startTransition(async () => {
      const result = await activateTheme(businessId, theme).catch(() => null)
      if (result?.ok) {
        toast.success(t("activated"))
        setPreview(null)
        router.refresh()
      } else {
        toast.error(settings("tryAgain"))
      }
    })

  return (
    <PageSection id="theme" title={t("title")}>
      {preview && <ThemePreview theme={preview} />}
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
                <Badge variant="success">{t("active")}</Badge>
              ) : theme.available ? (
                <>
                  <Button
                    variant="outline"
                    aria-pressed={preview === theme.id}
                    onClick={() =>
                      setPreview(preview === theme.id ? null : theme.id)
                    }
                    disabled={pending}
                  >
                    {t(preview === theme.id ? "stopPreview" : "preview")}
                  </Button>
                  <Button onClick={() => activate(theme.id)} disabled={pending}>
                    {pending && <Spinner data-icon="inline-start" />}
                    {t("activate")}
                  </Button>
                </>
              ) : (
                <Badge variant="secondary">{t("comingSoon")}</Badge>
              )}
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </PageSection>
  )
}
