import { useLocale, useTranslations } from "next-intl"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ExternalLinkIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { formatClock, formatWeekday } from "@/lib/format-booking-time"
import { initials } from "@/lib/initials"
import type { AdminBusiness } from "../api/queries"
import { AdminDeleteButton } from "./admin-delete-button"

// Every business: its owner, its bookings, a link to its public page and
// Delete (onDelete comes from the page).
export function BusinessesList({
  businesses,
  onDelete,
}: {
  businesses: AdminBusiness[]
  onDelete: (businessId: string) => Promise<{ ok: boolean }>
}) {
  const t = useTranslations("admin")
  const locale = useLocale()
  return (
    <ItemGroup className="gap-3">
      {businesses.map((business) => (
        <Item key={business.id} variant="outline">
          <ItemMedia>
            <Avatar>
              <AvatarFallback>{initials(business.name)}</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle>{business.name}</ItemTitle>
            <ItemDescription className="truncate">
              {`${business.ownerName ?? t("businesses.noOwner")} · ${t("businesses.bookings", { n: business.bookings })}`}
            </ItemDescription>
            {business.team?.map((member) => <div key={member.id} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{member.name}</span>
              {[member.description, member.phone, member.email].filter(Boolean).map((detail) => <span key={detail} className="text-muted-foreground">{detail}</span>)}
              {member.hours.length === 0 ? <span className="text-muted-foreground">{t("businesses.sameHours")}</span> : member.hours.map((row) =>
                <span key={row.id} className="text-muted-foreground">{formatWeekday(row.weekday, locale)} · {formatClock(row.opensAt, locale)}–{formatClock(row.closesAt, locale)}</span>
              )}
            </div>)}
            {business.customers && business.customers.length > 0 && <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("businesses.addedCustomers")}</span>
              {business.customers.map((customer) => <span key={customer.id} className="text-muted-foreground">{customer.phone ? `${customer.name} · ${customer.phone}` : customer.name}</span>)}
            </div>}
          </ItemContent>
          <ItemActions>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("businesses.open", { name: business.name })}
              nativeButton={false}
              render={
                <a
                  href={`/b/${business.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLinkIcon />
            </Button>
            <AdminDeleteButton
              name={business.name}
              description={t("remove.businessText")}
              onDelete={onDelete.bind(null, business.id)}
            />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}
