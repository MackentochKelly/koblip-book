import Link from "next/link"

import { StatStrip } from "@/components/stat-strip"
import { Badge } from "@/components/ui/badge"
import {
  ChevronRightIcon,
  ClockIcon,
  LanguagesIcon,
  OctagonXIcon,
  SquarePenIcon,
} from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import {
  TRANSLATION_SCOPES,
  type TranslationStatus,
} from "@/lib/translations/rules"
import type { TranslationOverview as Overview } from "../api/translations"
import type { AdminMessages } from "../i18n"
import { SCOPE_PART, translationPartHref } from "../utils/translation-parts"

// Admin → Translations → Overview (G5): what waits, failed or needs an
// admin, characters sent to Google this month against its free allowance,
// who translates, and each kind of text.
export function TranslationsOverview({
  overview,
  m,
}: {
  overview: Overview
  m: AdminMessages
}) {
  const t = m.translations
  const number = new Intl.NumberFormat(m.locale)
  const total = (status: TranslationStatus) =>
    overview.counts.interface[status] + overview.counts.business[status]
  const translator = overview.translator ?? "none"
  return (
    <div className="flex flex-col gap-6">
      <StatStrip
        stats={[
          {
            icon: <LanguagesIcon />,
            tone: "primary",
            label: t.overview.month,
            value: number.format(overview.monthCharacters),
          },
          {
            icon: <ClockIcon />,
            tone: "warning",
            label: t.states.pending,
            value: number.format(total("pending")),
          },
          {
            icon: <OctagonXIcon />,
            tone: "destructive",
            label: t.states.failed,
            value: number.format(total("failed")),
          },
          {
            icon: <SquarePenIcon />,
            tone: "info",
            label: t.states.needs_review,
            value: number.format(total("needs_review")),
          },
        ]}
      />

      <ItemGroup className="gap-3">
        <Item variant="outline">
          <ItemContent className="min-w-0">
            <ItemTitle>{t.overview.translator}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Badge variant={translator === "none" ? "destructive" : "secondary"}>
              {t.overview.translators[translator]}
            </Badge>
          </ItemActions>
        </Item>
        <Item variant="outline">
          <ItemContent className="min-w-0">
            <ItemTitle>{t.overview.free}</ItemTitle>
            <ItemDescription>
              {t.overview.freeUsed(
                number.format(overview.monthCharacters),
                number.format(overview.freeCharacters)
              )}
            </ItemDescription>
          </ItemContent>
        </Item>
        {TRANSLATION_SCOPES.map((scope) => {
          const counts = overview.counts[scope]
          return (
            <Item
              key={scope}
              variant="outline"
              render={<Link href={translationPartHref(SCOPE_PART[scope])} />}
            >
              <ItemContent className="min-w-0">
                <ItemTitle>{t.parts[SCOPE_PART[scope]]}</ItemTitle>
                <ItemDescription>
                  {t.overview.counts(
                    number.format(
                      counts.automatic + counts.edited + counts.needs_review
                    ),
                    number.format(counts.pending),
                    number.format(counts.failed)
                  )}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </ItemActions>
            </Item>
          )
        })}
      </ItemGroup>
    </div>
  )
}
