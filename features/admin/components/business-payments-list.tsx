import { useTranslations } from "next-intl"

import { PaymentTypeIcon } from "@/components/payment-type-icon"
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
import type { AdminBusinessPayments } from "../api/payments"

// Each business's ways to be paid outside the app, with whether paying at
// the visit is on and how many payments wait for its owner. Read only.
export function BusinessPaymentsList({
  businesses,
}: {
  businesses: AdminBusinessPayments[]
}) {
  const t = useTranslations("admin.payments")
  return (
    <div className="flex flex-col gap-8">
      {businesses.map((business) => (
        <section key={business.businessId} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-medium text-muted-foreground">
              {business.businessName}
            </h2>
            <Badge variant="outline">
              {t(`payLater.${business.payLater ? "on" : "off"}`)}
            </Badge>
            {business.toCheck > 0 && (
              <Badge variant="warning">
                {t("toCheck", { n: business.toCheck })}
              </Badge>
            )}
          </div>
          <ItemGroup className="gap-3">
            {business.methods.map((method) => (
              <Item key={method.id} variant="outline">
                <ItemMedia variant="icon">
                  <PaymentTypeIcon type={method.type} />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="max-w-full">
                    <span className="truncate">{method.name}</span>
                  </ItemTitle>
                  <ItemDescription className="break-words whitespace-pre-line">
                    {method.details}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant="secondary">{t(`types.${method.type}`)}</Badge>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </section>
      ))}
    </div>
  )
}
