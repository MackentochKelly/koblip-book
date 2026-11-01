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
import { AdminDeleteButton } from "./admin-delete-button"
import { OwnerBlockButton } from "./owner-block-button"

// Every account, newest first; any but the admin's own can be blocked or
// deleted (onDelete comes from the page).
export function OwnersList({
  owners,
  selfId,
  m,
  onDelete,
}: {
  owners: AdminOwner[]
  selfId: string
  m: AdminMessages
  onDelete: (userId: string) => Promise<{ ok: boolean }>
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
                <AdminDeleteButton
                  name={owner.name}
                  description={m.remove.ownerText}
                  onDelete={onDelete.bind(null, owner.id)}
                />
              </ItemActions>
            )}
          </Item>
        )
      })}
    </ItemGroup>
  )
}
