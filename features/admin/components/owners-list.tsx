import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { initials } from "@/lib/initials"
import type { AdminOwner } from "../api/queries"
import type { AdminMessages } from "../i18n"
import { OwnerBlockButton } from "./owner-block-button"

// Every account, newest first; any but the admin's own can be blocked.
export function OwnersList({
  owners,
  selfId,
  m,
}: {
  owners: AdminOwner[]
  selfId: string
  m: AdminMessages
}) {
  const t = m.owners
  return (
    <ItemGroup className="gap-3">
      {owners.map((owner) => {
        const self = owner.id === selfId
        return (
          <Item key={owner.id} variant="outline">
            <ItemMedia>
              <Avatar>
                {owner.image && <AvatarImage src={owner.image} alt="" />}
                <AvatarFallback>{initials(owner.name)}</AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="max-w-full">
                <span className="truncate">{owner.name}</span>
                {self && <Badge variant="secondary">{t.you}</Badge>}
                {owner.banned && <Badge variant="destructive">{t.blocked}</Badge>}
              </ItemTitle>
              <ItemDescription className="truncate">
                {`${owner.email} · ${t.businesses(owner.businesses)}`}
              </ItemDescription>
            </ItemContent>
            {!self && (
              <ItemActions>
                <OwnerBlockButton
                  userId={owner.id}
                  name={owner.name}
                  blocked={owner.banned}
                />
              </ItemActions>
            )}
          </Item>
        )
      })}
    </ItemGroup>
  )
}
