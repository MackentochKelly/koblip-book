"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

import { AppSelect } from "@/components/app-select"
import { ListFilters } from "@/components/list-filters"
import { SearchField } from "@/components/search-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { LanguagesIcon, SearchIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { noAutofill } from "@/lib/no-autofill"
import { TRANSLATION_LANGUAGES } from "@/lib/translations/languages"
import {
  TRANSLATION_STATUSES,
  type TranslationScope,
} from "@/lib/translations/rules"
import { cn } from "@/lib/utils"
import type { TranslationList as List, TranslationRow } from "../api/translations"
import {
  translationQuery,
  type TranslationFilter,
} from "../utils/translation-filter"
import {
  translationEntryHref,
  translationPartHref,
} from "../utils/translation-parts"
import { stateBadge, textLabels } from "../utils/translation-labels"

// "All" in a filter's menu: the filter is off.
const ANY = "any"

// Admin → Translations → Interface or Business texts (G5): every text in
// every language, what needs an admin first; searched and filtered by
// language, business or page, and state (the filters are in the address);
// a page of results at a time. A text opens its own screen.
export function TranslationList({
  scope,
  list,
  groups,
  filter,
}: {
  scope: TranslationScope
  list: List
  groups: { id: string; label: string }[]
  filter: TranslationFilter
}) {
  const words = useTranslations("admin.translations")
  const t = useTranslations("admin.translations.list")
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(filter.search ?? "")
  const [pending, startTransition] = useTransition()
  const number = new Intl.NumberFormat(useLocale())
  const filterCount =
    (filter.language ? 1 : 0) + (filter.state ? 1 : 0) + (filter.group ? 1 : 0)
  const filtered = filterCount > 0 || !!filter.search

  // A new search or filter starts again at the first page.
  const show = (next: TranslationFilter) =>
    startTransition(() => {
      router.replace(`${pathname}${translationQuery(next)}`, { scroll: false })
    })
  const clearPicks = () =>
    show({ search: filter.search, page: 1 })
  const hrefOf = (page: number) =>
    `${pathname}${translationQuery({ ...filter, page })}`

  if (list.total === 0 && !filtered) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LanguagesIcon />
          </EmptyMedia>
          <EmptyTitle>
            {scope === "interface" ? t("noneInterface") : t("noneBusiness")}
          </EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link
                href={
                  scope === "interface"
                    ? translationPartHref("business")
                    : "/admin/businesses"
                }
              />
            }
          >
            {scope === "interface" ? t("seeBusinessTexts") : t("seeBusinesses")}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const groupLabel = scope === "business" ? t("businessFilter") : t("pageFilter")
  const languageItems = [
    { value: ANY, label: t("allLanguages") },
    ...TRANSLATION_LANGUAGES.map((language) => ({
      value: language,
      label: words(`languages.${language}`),
    })),
  ]
  const stateItems = [
    { value: ANY, label: t("allStates") },
    ...TRANSLATION_STATUSES.map((state) => ({
      value: state,
      label: words(`states.${state}`),
    })),
  ]
  const groupItems = [
    { value: ANY, label: scope === "business" ? t("allBusinesses") : t("allPages") },
    ...groups.map((group) => ({ value: group.id, label: group.label })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <ListFilters
        search={
          // Search runs on Enter, like Activity's: one query per search.
          <form
            role="search"
            className="min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault()
              show({ ...filter, search: query.trim() || undefined, page: 1 })
            }}
          >
            <SearchField
              {...noAutofill(`translations-${scope}`)}
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search")}
              aria-label={t("searchLabel")}
            />
          </form>
        }
        filters={[
          {
            key: "language",
            label: t("languageFilter"),
            control: (
              <AppSelect
                options={languageItems}
                value={filter.language ?? ANY}
                onValueChange={(value) =>
                  show({
                    ...filter,
                    language:
                      value === ANY
                        ? undefined
                        : TRANSLATION_LANGUAGES.find((item) => item === value),
                    page: 1,
                  })
                }
                className="w-full md:w-auto"
                aria-label={t("languageFilter")}
              />
            ),
          },
          {
            key: "group",
            label: groupLabel,
            control: (
              <AppSelect
                options={groupItems}
                value={filter.group ?? ANY}
                onValueChange={(value) =>
                  show({
                    ...filter,
                    group: value === ANY ? undefined : value,
                    page: 1,
                  })
                }
                className="w-full md:w-auto"
                aria-label={groupLabel}
              />
            ),
          },
          {
            key: "state",
            label: t("stateFilter"),
            control: (
              <AppSelect
                options={stateItems}
                value={filter.state ?? ANY}
                onValueChange={(value) =>
                  show({
                    ...filter,
                    state:
                      value === ANY
                        ? undefined
                        : TRANSLATION_STATUSES.find((item) => item === value),
                    page: 1,
                  })
                }
                className="w-full md:w-auto"
                aria-label={t("stateFilter")}
              />
            ),
          },
        ]}
        count={filterCount}
        onClear={clearPicks}
        rowClear={filterCount > 0 ? clearPicks : undefined}
        words={{
          filters: t("filters"),
          clearAll: t("clearFilters"),
          clear: t("clearFilters"),
          showResults: t("showResults"),
        }}
      />

      <div
        aria-busy={pending}
        className={cn("flex flex-col gap-4 transition-opacity", pending && "opacity-60")}
      >
        {list.rows.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon />
              </EmptyMedia>
              <EmptyTitle>{t("noneFound")}</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("")
                  show({ page: 1 })
                }}
              >
                {t("clearFilters")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t("results", { n: number.format(list.total) })}
            </p>
            <ItemGroup className="gap-2">
              {list.rows.map((row) => (
                <TranslationItem key={row.id} row={row} />
              ))}
            </ItemGroup>
          </>
        )}

        {list.pages > 1 && (
          <Pagination aria-label={t("pagesLabel")}>
            <PaginationContent className="w-full justify-between">
              <PaginationItem>
                {list.page > 1 && (
                  <PaginationPrevious
                    href={hrefOf(list.page - 1)}
                    text={t("previous")}
                    aria-label={t("previousLabel")}
                    onClick={(event) => {
                      event.preventDefault()
                      show({ ...filter, page: list.page - 1 })
                    }}
                  />
                )}
              </PaginationItem>
              <PaginationItem className="text-sm text-muted-foreground">
                {t("pageOf", {
                  page: number.format(list.page),
                  pages: number.format(list.pages),
                })}
              </PaginationItem>
              <PaginationItem>
                {list.page < list.pages && (
                  <PaginationNext
                    href={hrefOf(list.page + 1)}
                    text={t("next")}
                    aria-label={t("nextLabel")}
                    onClick={(event) => {
                      event.preventDefault()
                      show({ ...filter, page: list.page + 1 })
                    }}
                  />
                )}
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  )
}

// One text in one language: its English, the translation, where it is from
// and its state.
function TranslationItem({ row }: { row: TranslationRow }) {
  const t = useTranslations("admin.translations")
  const labels = textLabels(row, t)
  return (
    <Item
      variant="outline"
      size="sm"
      render={<Link href={translationEntryHref(row.scope, row.id)} />}
    >
      <ItemContent className="min-w-0">
        <ItemTitle className="line-clamp-2 break-words">{row.sourceText}</ItemTitle>
        <ItemDescription className="line-clamp-2 break-words">
          {row.text ?? t("list.noTranslation")}
        </ItemDescription>
        <ItemDescription className="truncate">
          {[labels.where, labels.what, labels.language].join(" · ")}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant={stateBadge(row.status)}>{t(`states.${row.status}`)}</Badge>
      </ItemActions>
    </Item>
  )
}
