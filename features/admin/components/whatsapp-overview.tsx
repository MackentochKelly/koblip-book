import { useLocale, useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { WHATSAPP_ADMIN_RULES } from "@/lib/whatsapp-admin-rules"
import type { WhatsappOverview as Overview } from "../api/whatsapp-overview"
import { formatAgo } from "@/lib/format-ago"
import { StatStrip } from "@/components/stat-strip"
import { ClockIcon, OctagonXIcon } from "@/components/ui/icons"

// The admin's WhatsApp Overview (A2): what waits and failed, whether the
// timer runs, whether Koblip Chat answers, and which server settings are set.
export function WhatsappOverview({ overview }: { overview: Overview }) {
  const t = useTranslations("admin.whatsapp.overview")
  const locale = useLocale()
  const { timer, chat } = overview
  const number = new Intl.NumberFormat(locale)
  return (
    <div className="flex flex-col gap-6">
      <StatStrip
        stats={[
          {
            icon: <ClockIcon />,
            tone: "warning",
            label: t("waiting"),
            value: number.format(overview.waiting),
          },
          {
            icon: <OctagonXIcon />,
            tone: "destructive",
            label: t("failed", { days: WHATSAPP_ADMIN_RULES.failedDays }),
            value: number.format(overview.failed),
          },
        ]}
      />

      <ItemGroup className="gap-3">
        <Item variant="outline">
          <ItemContent className="min-w-0">
            <ItemTitle>{t("timer")}</ItemTitle>
            <ItemDescription className="line-clamp-2">
              {timer.state === "never"
                ? t("timerNever")
                : timer.lastError
                  ? t("timerError", { error: timer.lastError })
                  : t("timerLast", { ago: formatAgo(timer.lastRunAt, overview.now, locale) })}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge
              variant={
                timer.state === "running" && !timer.lastError
                  ? "secondary"
                  : "destructive"
              }
            >
              {timer.state === "running" ? t("running") : t("stopped")}
            </Badge>
          </ItemActions>
        </Item>

        <Item variant="outline">
          <ItemContent className="min-w-0">
            <ItemTitle>{t("chat")}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Badge variant={chat === "reachable" ? "secondary" : "destructive"}>
              {t(`chatStates.${chat}`)}
            </Badge>
          </ItemActions>
        </Item>
      </ItemGroup>

      <section
        className="flex flex-col gap-3"
        aria-labelledby="whatsapp-secrets"
      >
        <h2
          id="whatsapp-secrets"
          className="text-lg font-semibold tracking-tight"
        >
          {t("secrets")}
        </h2>
        <ItemGroup className="gap-3">
          {overview.secrets.map((secret) => (
            <Item key={secret.name} variant="outline">
              <ItemContent className="min-w-0">
                <ItemTitle className="font-mono break-all">
                  {secret.name}
                </ItemTitle>
              </ItemContent>
              <ItemActions>
                <Badge variant={secret.set ? "secondary" : "destructive"}>
                  {secret.set ? t("set") : t("missing")}
                </Badge>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </section>
    </div>
  )
}
