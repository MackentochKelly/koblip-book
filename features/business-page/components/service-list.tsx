import { PageSection } from "@/components/page-section"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import type { Service } from "../types"
import { formatDuration } from "../utils/format-duration"
import { formatPrice } from "../utils/format-price"

export function ServiceList({
  services,
  currency,
}: {
  services: Service[]
  currency: string
}) {
  if (services.length === 0) {
    return null
  }
  return (
    <PageSection title="Services">
      <ItemGroup className="gap-1">
        {services.map((service) => (
          <Item key={service.id} size="sm" className="px-0">
            <ItemContent>
              <ItemTitle>{service.name}</ItemTitle>
              <ItemDescription>
                {formatDuration(service.durationMinutes)}
              </ItemDescription>
            </ItemContent>
            <ItemActions className="text-sm font-medium">
              {formatPrice(service.priceMinor, currency)}
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </PageSection>
  )
}
