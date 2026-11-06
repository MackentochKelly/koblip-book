"use client"

import { useLocale, useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { SparklesIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import type { AdminPendingAction } from "../api/assistant"
import { AdminPage } from "./admin-page"

// Assistant (A8): every card waiting for an owner's tap, newest first, at
// its business's clock time.
export function AdminAssistant({ rows }: { rows: AdminPendingAction[] }) {
  const t = useTranslations("admin")
  const locale = useLocale()

  const when = (row: AdminPendingAction) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: row.timezone,
    }).format(new Date(row.at))

  return (
    <AdminPage
      title={t("nav.assistant")}
      icon={<SparklesIcon />}
      empty={rows.length === 0 ? t("assistant.none") : null}
    >
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("assistant.waitingCards")}</h2>
        <ItemGroup className="gap-2">
          {rows.map((row) => (
            <Item key={row.id} variant="outline" size="sm">
              <ItemContent className="min-w-0">
                <ItemTitle className="font-mono">{row.toolName}</ItemTitle>
                <ItemDescription>
                  {[row.businessName, row.ownerEmail, when(row)].join(" · ")}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge variant={row.live ? "secondary" : "outline"}>
                  {row.live ? t("assistant.waiting") : t("assistant.expired")}
                </Badge>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </section>
    </AdminPage>
  )
}
