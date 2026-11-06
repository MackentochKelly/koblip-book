import { useTranslations } from "next-intl"

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
import { AdminDeleteButton } from "./admin-delete-button"
import { OwnerBlockButton } from "./owner-block-button"

// Every account, newest first; any but the admin's own can be blocked or
// deleted (onDelete comes from the page).
export function OwnersList({
  owners,
  selfId,
  onDelete,
}: {
  owners: AdminOwner[]
  selfId: string
  onDelete: (userId: string) => Promise<{ ok: boolean }>
}) {
  const t = useTranslations("admin")
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
                {self && <Badge variant="secondary">{t("owners.you")}</Badge>}
                {owner.banned && <Badge variant="destructive">{t("owners.blocked")}</Badge>}
              </ItemTitle>
              <ItemDescription className="truncate">
                {`${owner.email} · ${t("owners.businesses", { n: owner.businesses })}`}
              </ItemDescription>
              <ItemDescription className="truncate" title={owner.voice?.voiceId}>
                {`${t("owners.voice")}: ${owner.voice?.name ?? owner.voice?.voiceId ?? t("owners.noVoice")}`}
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
                  description={t("remove.ownerText")}
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
