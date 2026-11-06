"use client"

import { useLocale, useTranslations } from "next-intl"

import { PageSection } from "@/components/page-section"
import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { CLIENT_REMINDER_CHANNELS } from "@/lib/client-reminder-channels"
import type { AdminClientReminders } from "../api/client-reminders"

// Client reminders (client account D16): how many accounts picked each
// way (no pick means WhatsApp), then every reminder email.
export function ClientReminders({ channels, emails }: AdminClientReminders) {
  const t = useTranslations("admin.notifications.clientReminders")
  const locale = useLocale()
  const when = (iso: string, timeZone: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(new Date(iso))
  return (
    <PageSection id="client-reminders" title={t("title")}>
      <ItemGroup className="gap-3">
        <Item variant="outline" size="sm">
          <ItemContent>
            {CLIENT_REMINDER_CHANNELS.map((channel) => (
              <ItemTitle key={channel}>
                {t(`channels.${channel}`, {
                  n: channels.find((row) => row.channel === channel)?.accounts ?? 0,
                })}
              </ItemTitle>
            ))}
            <ItemDescription>{t("othersWhatsapp")}</ItemDescription>
          </ItemContent>
        </Item>
      </ItemGroup>
      <h3 className="text-sm font-medium text-muted-foreground">{t("emails")}</h3>
      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ItemGroup className="gap-3">
          {emails.map((email) => (
            <Item key={email.id} variant="outline">
              <ItemContent className="min-w-0">
                <ItemTitle>{email.clientName ?? t("deletedAccount")}</ItemTitle>
                <ItemDescription className="truncate">
                  {`${email.businessName} · ${email.serviceName} · ${when(email.startAt, email.timezone)}`}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge
                  variant={email.state === "failed" ? "destructive" : "outline"}
                >
                  {t(`states.${email.state}`)}
                </Badge>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </PageSection>
  )
}
