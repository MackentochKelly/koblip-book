import { Badge } from "@/components/ui/badge"
import { ClockIcon } from "@/components/ui/icons"
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
import type { WhatsappWindow as Window, WindowEntry } from "../api/whatsapp-window"
import type { AdminMessages } from "../i18n"
import { formatAgo } from "../utils/format-ago"
import { WhatsappWindowRemove } from "./whatsapp-window-remove"

// WhatsApp → 24-hour window (A6): each customer who wrote, to which number
// and when, open or closed; any entry can be removed.
export function WhatsappWindow({ list, m }: { list: Window; m: AdminMessages }) {
  const t = m.whatsapp.window
  if (!list.entries.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClockIcon />
          </EmptyMedia>
          <EmptyTitle>{t.none}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  const numberOf = ({ number }: WindowEntry) =>
    number.kind === "koblip"
      ? t.koblipNumber
      : number.kind === "own"
        ? number.businesses.join(", ")
        : t.unknownNumber
  return (
    <ItemGroup className="gap-3">
      {list.entries.map((entry) => {
        const phone = `+${entry.customerPhone}`
        return (
          <Item
            key={`${entry.workspaceId}:${entry.phoneNumberId}:${entry.customerPhone}`}
            variant="outline"
          >
            <ItemContent className="min-w-0">
              <ItemTitle>{phone}</ItemTitle>
              <ItemDescription className="truncate">
                {`${numberOf(entry)} · ${t.wrote(formatAgo(entry.lastReplyAt, list.now, m.locale))}`}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant={entry.open ? "secondary" : "outline"}>
                {entry.open ? t.open : t.closed}
              </Badge>
              <WhatsappWindowRemove
                entry={{
                  workspaceId: entry.workspaceId,
                  phoneNumberId: entry.phoneNumberId,
                  customerPhone: entry.customerPhone,
                }}
                phone={phone}
              />
            </ItemActions>
          </Item>
        )
      })}
    </ItemGroup>
  )
}
