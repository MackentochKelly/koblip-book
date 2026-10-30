import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { ChevronRightIcon, StoreIcon } from "@/components/ui/icons"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import type { WhatsappBusinessRow } from "../api/whatsapp-businesses"
import type { AdminMessages } from "../i18n"
import { WHATSAPP_BASE } from "../utils/whatsapp-parts"

export type BusinessConnection = {
  businessId: string
  workspaceName: string
  needsReconnect: boolean
}

// WhatsApp → Businesses (A4): each business, the number it sends from and
// how many of its messages are off; each opens its own screen.
export function WhatsappBusinesses({
  businesses,
  connections,
  m,
}: {
  businesses: WhatsappBusinessRow[]
  connections: BusinessConnection[]
  m: AdminMessages
}) {
  const t = m.whatsapp.businesses
  if (!businesses.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <StoreIcon />
          </EmptyMedia>
          <EmptyTitle>{t.none}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  const byBusiness = new Map(connections.map((row) => [row.businessId, row]))
  return (
    <ItemGroup className="gap-3">
      {businesses.map((business) => {
        const connection = byBusiness.get(business.id)
        return (
          <Item
            key={business.id}
            variant="outline"
            render={
              <Link href={`${WHATSAPP_BASE}/businesses/${business.id}`} />
            }
          >
            <ItemContent className="min-w-0">
              <ItemTitle>{business.name}</ItemTitle>
              <ItemDescription className="truncate">
                {`${connection ? t.ownNumber(connection.workspaceName) : t.koblipNumber} · ${
                  business.messagesOff
                    ? t.messagesOff(business.messagesOff)
                    : t.allOn
                }`}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              {connection?.needsReconnect && (
                <Badge variant="destructive">{t.reconnect}</Badge>
              )}
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </ItemActions>
          </Item>
        )
      })}
    </ItemGroup>
  )
}
