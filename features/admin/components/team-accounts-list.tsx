import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { initials } from "@/lib/initials"
import type { AdminTeamAccount, AdminTeamInvite } from "../api/queries"
import type { AdminMessages } from "../i18n"

// Team members with their own account, then the invite links still open.
export function TeamAccountsList({
  joined,
  invites,
  m,
}: {
  joined: AdminTeamAccount[]
  invites: AdminTeamInvite[]
  m: AdminMessages
}) {
  const t = m.team
  const day = new Intl.DateTimeFormat(m.locale, { dateStyle: "medium" })
  return (
    <div className="flex flex-col gap-8">
      {joined.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t.joined}</h2>
          <ItemGroup className="gap-3">
            {joined.map((row) => (
              <Item key={row.teamMemberId} variant="outline">
                <ItemMedia>
                  <Avatar>
                    <AvatarFallback>{initials(row.memberName)}</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="max-w-full">
                    <span className="truncate">{row.memberName}</span>
                  </ItemTitle>
                  <ItemDescription className="truncate">
                    {`${row.email} · ${t.at(row.businessName)}`}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </section>
      )}
      {invites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t.invites}</h2>
          <ItemGroup className="gap-3">
            {invites.map((row) => (
              <Item key={row.id} variant="outline">
                <ItemContent className="min-w-0">
                  <ItemTitle className="max-w-full">
                    <span className="truncate">{row.memberName}</span>
                  </ItemTitle>
                  <ItemDescription className="truncate">
                    {`${t.at(row.businessName)} · ${t.expires(day.format(new Date(row.expiresAt)))}`}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </section>
      )}
    </div>
  )
}
