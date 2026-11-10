"use client"

import { useFormatter, useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import type {
  PartnerEventState,
  PartnerEventType,
  PartnerInviteState,
} from "@/lib/partner-rules"
import type { AdminPartnerEvent, AdminPartnerInvite } from "../api/partners"

const INVITE_BADGE: Record<
  PartnerInviteState,
  "success" | "secondary" | "warning"
> = {
  open: "warning",
  claimed: "success",
  ended: "secondary",
  revoked: "secondary",
}

const EVENT_BADGE: Record<
  PartnerEventState,
  "success" | "destructive" | "warning"
> = {
  pending: "warning",
  sent: "success",
  failed: "destructive",
}

// Word keys can't hold a dot, so each event type has its own.
const EVENT_WORD = {
  "invite.opened": "inviteOpened",
  "invite.claimed": "inviteClaimed",
  "plan.started": "planStarted",
} as const satisfies Record<PartnerEventType, string>

// Partners' invites and the events sent about them (SC10), newest first.
export function PartnerInvites({ invites }: { invites: AdminPartnerInvite[] }) {
  const t = useTranslations("admin.partners.invites")
  const format = useFormatter()
  const day = (at: string) =>
    format.dateTime(new Date(at), { dateStyle: "medium" })
  if (invites.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("none")}</p>
  }
  return (
    <ItemGroup className="gap-3">
      {invites.map((invite) => (
        <Item key={invite.id} variant="outline" size="sm">
          <ItemContent>
            <ItemTitle>
              {invite.businessName ?? invite.placeId}
              <Badge variant={INVITE_BADGE[invite.state]}>
                {t(`states.${invite.state}`)}
              </Badge>
            </ItemTitle>
            <ItemDescription>
              {[
                invite.appName,
                invite.ref && t("ref", { ref: invite.ref }),
                t("made", { day: day(invite.createdAt) }),
                invite.openedAt && t("opened", { day: day(invite.openedAt) }),
                invite.claimedAt &&
                  t("claimed", { day: day(invite.claimedAt) }),
                invite.state === "open" && t("ends", { day: day(invite.endsAt) }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
}

export function PartnerEvents({ events }: { events: AdminPartnerEvent[] }) {
  const t = useTranslations("admin.partners.events")
  const format = useFormatter()
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("none")}</p>
  }
  return (
    <ItemGroup className="gap-3">
      {events.map((event) => (
        <Item key={event.id} variant="outline" size="sm">
          <ItemContent>
            <ItemTitle>
              {t(`types.${EVENT_WORD[event.type]}`)}
              <Badge variant={EVENT_BADGE[event.state]}>
                {t(`states.${event.state}`)}
              </Badge>
            </ItemTitle>
            <ItemDescription>
              {[
                event.appName,
                format.dateTime(new Date(event.createdAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
                t("attempts", { n: event.attempts }),
                event.lastError,
              ]
                .filter(Boolean)
                .join(" · ")}
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
}
