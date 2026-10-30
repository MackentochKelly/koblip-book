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
import type { AdminMessages } from "../i18n"
import { StatCards } from "./stat-cards"

// How long ago, in the largest unit that fits ("3 minutes ago").
function ago(iso: string, now: number, locale: string) {
  const seconds = Math.round((Date.parse(iso) - now) / 1000)
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const units = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ] as const
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size)
      return format.format(Math.round(seconds / size), unit)
  }
  return format.format(seconds, "second")
}

// The admin's WhatsApp Overview (A2): what waits and failed, whether the
// timer runs, whether Koblip Chat answers, and which server settings are set.
export function WhatsappOverview({
  overview,
  m,
}: {
  overview: Overview
  m: AdminMessages
}) {
  const t = m.whatsapp.overview
  const { timer, chat } = overview
  return (
    <div className="flex flex-col gap-6">
      <StatCards
        locale={m.locale}
        stats={[
          { label: t.waiting, value: overview.waiting },
          {
            label: t.failed(WHATSAPP_ADMIN_RULES.failedDays),
            value: overview.failed,
          },
        ]}
      />

      <ItemGroup className="gap-3">
        <Item variant="outline">
          <ItemContent className="min-w-0">
            <ItemTitle>{t.timer}</ItemTitle>
            <ItemDescription className="line-clamp-2">
              {timer.state === "never"
                ? t.timerNever
                : timer.lastError
                  ? t.timerError(timer.lastError)
                  : t.timerLast(ago(timer.lastRunAt, overview.now, m.locale))}
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
              {timer.state === "running" ? t.running : t.stopped}
            </Badge>
          </ItemActions>
        </Item>

        <Item variant="outline">
          <ItemContent className="min-w-0">
            <ItemTitle>{t.chat}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Badge variant={chat === "reachable" ? "secondary" : "destructive"}>
              {t.chatStates[chat]}
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
          {t.secrets}
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
                  {secret.set ? t.set : t.missing}
                </Badge>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </section>
    </div>
  )
}
