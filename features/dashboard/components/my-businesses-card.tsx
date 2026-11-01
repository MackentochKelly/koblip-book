import Image from "next/image"
import Link from "next/link"
import { ChevronRightIcon, StoreIcon } from "@/components/ui/icons"

import { GlassCard } from "@/components/glass-frame"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import type { OwnedBusiness } from "../types"

// Add business: the businesses the owner already has, under the search, in
// the same glass frame. Each opens its dashboard.
export function MyBusinessesCard({
  businesses,
  labels,
}: {
  businesses: OwnedBusiness[]
  labels: { title: string }
}) {
  return (
    <GlassCard className="max-w-xl">
      <section aria-labelledby="my-businesses" className="flex flex-col gap-3">
        <h2
          id="my-businesses"
          className="text-sm font-medium text-muted-foreground"
        >
          {labels.title}
        </h2>
        {/* Rows reach the card's edges; their text lines up with the title. */}
        <ItemGroup className="-mx-4 gap-1">
          {businesses.map((business) => (
            <Item
              key={business.id}
              render={<Link href={`/dashboard/${business.id}`} />}
            >
              <ItemMedia variant="image" className="bg-muted">
                {business.photoUrl ? (
                  <Image
                    src={business.photoUrl}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                  />
                ) : (
                  <StoreIcon className="text-muted-foreground" />
                )}
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="max-w-full">
                  <span className="truncate">{business.name}</span>
                </ItemTitle>
                <ItemDescription className="truncate">
                  {[business.category, business.address]
                    .filter(Boolean)
                    .join(" · ")}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRightIcon className="text-muted-foreground" />
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </section>
    </GlassCard>
  )
}
