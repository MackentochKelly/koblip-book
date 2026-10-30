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
import { formatAgo } from "../utils/format-ago"
import { StatCards } from "./stat-cards"

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
                  : t.timerLast(formatAgo(timer.lastRunAt, overview.now, m.locale))}
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
