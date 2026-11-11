"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"

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
import { MailIcon, SearchIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { EMAIL_ACTIVITY_STATES, emailFilterQuery } from "@/lib/email-activity-filter"
import type { EmailKind } from "@/lib/email-rules"
import { noAutofill } from "@/lib/no-autofill"
import { cn } from "@/lib/utils"
import type { EmailActivityFilter, EmailActivityRow } from "@/types/email"

// "Any" in a filter's menu: the filter is off.
const ANY = "any"

// The words the list shows, in the page's language.
export type EmailActivityLabels = {
  locale: string
  // Each email in `kinds` by name.
  names: Partial<Record<EmailKind, string>>
  noHistory: string
  search: string
  searchLabel: string
  emailFilter: string
  stateFilter: string
  filters: string
  // The phone's filters sheet closes on it.
  showResults: string
  allEmails: string
  allStates: string
  noneFound: string
  clearFilters: string
  // The send states and Amazon's delivery answers.
  states: Record<string, string>
  // Why an email was not sent.
  reasons: Record<string, string>
}

// The history of emails (docs/plans/email.md): a business's booking emails
// on its Email page (EM-10), every email in the admin (EM-11). Which, to
// whom, when, and what became of it; filtered by email (one of `kinds`) and
// status, searched by name or address. The filters live in the address.
// Times show in `timeZone`, or with `showBusiness` in each row's business's
// own, and the row names its business. `emptyAction` is the one action
// under "No emails yet".
export function EmailActivityList({
  rows,
  kinds,
  filter,
  timeZone,
  labels: t,
  showBusiness = false,
  emptyAction,
}: {
  rows: EmailActivityRow[]
  kinds: readonly EmailKind[]
  filter: EmailActivityFilter
  timeZone?: string
  labels: EmailActivityLabels
  showBusiness?: boolean
  emptyAction?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(filter.search ?? "")
  const [pending, startTransition] = useTransition()
  const filtered = !!(filter.kind || filter.state || filter.search)
  const filterCount = (filter.kind ? 1 : 0) + (filter.state ? 1 : 0)
  const formatters = new Map<string, Intl.DateTimeFormat>()
  const when = (row: EmailActivityRow) => {
    const zone = (showBusiness ? row.timeZone : timeZone) ?? undefined
    const key = zone ?? ""
    let format = formatters.get(key)
    if (!format) {
      format = new Intl.DateTimeFormat(t.locale, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: zone,
      })
      formatters.set(key, format)
    }
    return format.format(new Date(row.at))
  }

  const show = (next: EmailActivityFilter) =>
    startTransition(() => {
      router.replace(`${pathname}${emailFilterQuery(next)}`, { scroll: false })
    })
  // Clears the picks, keeping the search.
  const clearPicks = () => show({ ...filter, kind: undefined, state: undefined })

  if (rows.length === 0 && !filtered) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MailIcon />
          </EmptyMedia>
          <EmptyTitle>{t.noHistory}</EmptyTitle>
        </EmptyHeader>
        {emptyAction && <EmptyContent>{emptyAction}</EmptyContent>}
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ListFilters
        search={
          // Search runs on Enter, like a mail search: one query per search.
          <form
            role="search"
            className="min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault()
              show({ ...filter, search: query.trim() || undefined })
            }}
          >
            <SearchField
              {...noAutofill("email-history")}
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.search}
              aria-label={t.searchLabel}
            />
          </form>
        }
        filters={[
          {
            key: "email",
            label: t.emailFilter,
            control: (
              <AppSelect
                options={[
                  { value: ANY, label: t.allEmails },
                  ...kinds.map((kind) => ({ value: kind, label: t.names[kind] ?? kind })),
                ]}
                value={filter.kind ?? ANY}
                onValueChange={(value) =>
                  show({
                    ...filter,
                    kind: value === ANY ? undefined : (value as EmailKind),
                  })
                }
                className="w-full md:w-auto"
                aria-label={t.emailFilter}
              />
            ),
          },
          {
            key: "state",
            label: t.stateFilter,
            control: (
              <AppSelect
                options={[
                  { value: ANY, label: t.allStates },
                  ...EMAIL_ACTIVITY_STATES.map((state) => ({ value: state, label: t.states[state] })),
                ]}
                value={filter.state ?? ANY}
                onValueChange={(value) =>
                  show({
                    ...filter,
                    state: value === ANY ? undefined : (value as EmailActivityFilter["state"]),
                  })
                }
                className="w-full md:w-auto"
                aria-label={t.stateFilter}
              />
            ),
          },
        ]}
        count={filterCount}
        onClear={clearPicks}
        rowClear={filterCount > 0 ? clearPicks : undefined}
        words={{
          filters: t.filters,
          clearAll: t.clearFilters,
          clear: t.clearFilters,
          showResults: t.showResults,
        }}
      />

      <div aria-busy={pending} className={cn("transition-opacity", pending && "opacity-60")}>
        {rows.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon />
              </EmptyMedia>
              <EmptyTitle>{t.noneFound}</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("")
                  show({})
                }}
              >
                {t.clearFilters}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ItemGroup className="gap-2">
            {rows.map((row) => {
              // A sent email shows what Amazon said about it, once it has.
              const shown = row.state === "sent" && row.delivery ? row.delivery : row.state
              const bad =
                shown === "failed" ||
                shown === "bounced" ||
                shown === "complained" ||
                shown === "rejected"
              return (
                <Item key={row.id} variant="outline" size="sm">
                  <ItemContent className="min-w-0">
                    <ItemTitle>{t.names[row.kind] ?? row.kind}</ItemTitle>
                    <ItemDescription className="truncate">
                      {[
                        showBusiness && row.businessName,
                        row.customerName,
                        row.email,
                        when(row),
                        row.reason && t.reasons[row.reason],
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge
                      variant={
                        bad
                          ? "destructive"
                          : shown === "skipped" || shown === "pending"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {t.states[shown] ?? shown}
                    </Badge>
                  </ItemActions>
                </Item>
              )
            })}
          </ItemGroup>
        )}
      </div>
    </div>
  )
}
