"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { ExternalLinkIcon, LanguagesIcon } from "lucide-react"
import { toast } from "sonner"

import { PageSection } from "@/components/page-section"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"
import { translateBusiness } from "../api/translation-actions"
import type { TranslationStatus } from "../translation-types"

// Meta AI writes the page's About and services in Spanish. Changed texts
// show in English until they are translated again.
export function SpanishSection({
  businessId,
  slug,
  status,
}: {
  businessId: string
  slug: string
  status: TranslationStatus
}) {
  const m = useOwnerMessages()
  const t = m.settings.spanish
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const missing = status.total - status.upToDate
  const translate = () =>
    startTransition(async () => {
      const result = await translateBusiness(businessId).catch(() => null)
      if (result?.ok) {
        toast.success(t.translated)
        router.refresh()
      } else {
        toast.error(result?.error === "ai_off" ? t.aiOffToast : t.failed)
      }
    })

  return (
    <PageSection id="spanish" title={t.title}>
      <Item variant="outline">
        <ItemMedia variant="icon">
          <LanguagesIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Español</ItemTitle>
          <ItemDescription>
            {!status.enabled
              ? t.aiOff
              : missing === 0
                ? t.upToDate
                : t.toTranslate(missing)}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          {missing > 0 && status.enabled && (
            <Button size="sm" onClick={translate} disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {t.translate}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t.view}
            title={t.view}
            nativeButton={false}
            render={
              <a href={`/b/${slug}?lang=es`} target="_blank" rel="noreferrer" />
            }
          >
            <ExternalLinkIcon />
          </Button>
        </ItemActions>
      </Item>
    </PageSection>
  )
}
