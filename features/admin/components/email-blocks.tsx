"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { SearchField } from "@/components/search-field"
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
import { Spinner } from "@/components/ui/spinner"
import { noAutofill } from "@/lib/no-autofill"
import { cn } from "@/lib/utils"
import { removeEmailBlock } from "../api/email-actions"
import type { EmailBlockRow } from "../api/email"

// Email → Blocked (docs/plans/email.md, EM-11): every address that gets no
// more email, for every business or one, why and since when; searched by
// address (?q=). Any address can be unblocked, after asking.
export function EmailBlocks({ rows, search }: { rows: EmailBlockRow[]; search?: string }) {
  const t = useTranslations("admin.email.blocked")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(search ?? "")
  const [pending, startTransition] = useTransition()
  const show = (text: string) =>
    startTransition(() => {
      router.replace(text ? `${pathname}?q=${encodeURIComponent(text)}` : pathname, {
        scroll: false,
      })
    })
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })

  if (rows.length === 0 && !search) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MailIcon />
          </EmptyMedia>
          <EmptyTitle>{t("none")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search runs on Enter, like a mail search. */}
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          show(query.trim())
        }}
      >
        <SearchField
          {...noAutofill("email-blocks")}
          enterKeyHint="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search")}
          aria-label={t("searchLabel")}
        />
      </form>
      <div aria-busy={pending} className={cn("transition-opacity", pending && "opacity-60")}>
        {rows.length === 0 ? (
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
                  show("")
                }}
              >
                {t("clear")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ItemGroup className="gap-2">
            {rows.map((row) => (
              <Item key={row.id} variant="outline" size="sm">
                <ItemContent className="min-w-0">
                  <ItemTitle className="break-all">{row.email}</ItemTitle>
                  <ItemDescription className="truncate">
                    {[
                      row.businessName ?? t("everyBusiness"),
                      t(`reasons.${row.reason}`),
                      when.format(new Date(row.createdAt)),
                    ].join(" · ")}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Unblock row={row} />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </div>
    </div>
  )
}

// Unblocks one address, after asking.
function Unblock({ row }: { row: EmailBlockRow }) {
  const t = useTranslations("admin.email.blocked")
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const unblock = () =>
    startTransition(async () => {
      const result = await removeEmailBlock(row.id).catch(() => null)
      if (result?.ok) toast.success(t("unblocked"))
      else toast.error(t("failed"))
    })
  return (
    <>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => setAsking(true)}
        aria-label={t("unblockLabel", { email: row.email })}
      >
        {pending && <Spinner data-icon="inline-start" />}
        {t("unblock")}
      </Button>
      <ConfirmDialog
        open={asking}
        title={t("unblockTitle", { email: row.email })}
        description={t("unblockText")}
        confirm={t("unblock")}
        cancel={t("cancel")}
        tone="default"
        onConfirm={unblock}
        onClose={() => setAsking(false)}
      />
    </>
  )
}
