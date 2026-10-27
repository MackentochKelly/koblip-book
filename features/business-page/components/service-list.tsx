"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { PageSection } from "@/components/page-section"
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item"
import type { Service } from "../types"
import { formatDuration } from "../utils/format-duration"
import { formatPrice } from "../utils/format-price"

// How many services the page shows before See all.
const SERVICES_PREVIEW = 3

const plain = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")

// Under the name: length · description (left out when it only repeats the
// name), then the price.
function ServiceFacts({
  service,
  currency,
}: {
  service: Service
  currency: string
}) {
  const description =
    service.description && plain(service.description) !== plain(service.name)
      ? service.description
      : null
  return (
    <>
      <p className="line-clamp-1 text-xs font-normal text-muted-foreground">
        {formatDuration(service.durationMinutes)}
        {description && ` · ${description}`}
      </p>
      {service.priceMinor !== null && (
        <p className="text-sm font-medium text-foreground">
          {service.priceMinor === 0
            ? "Free"
            : formatPrice(service.priceMinor, currency)}
        </p>
      )}
    </>
  )
}

// What the business sells, like Fresha: a few cards, then See all.
export function ServiceList({
  services,
  currency,
}: {
  services: Service[]
  currency: string
}) {
  const [all, setAll] = useState(false)
  if (services.length === 0) return null
  const shown = all ? services : services.slice(0, SERVICES_PREVIEW)
  const more = services.length > shown.length
  return (
    <PageSection id="services" title="Services">
      <ItemGroup className="gap-3">
        {shown.map((service) => (
          <Item key={service.id} variant="outline">
            <ItemContent>
              <ItemTitle>
                <span className="truncate text-base font-semibold">
                  {service.name}
                </span>
              </ItemTitle>
              <ServiceFacts service={service} currency={currency} />
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
      {more && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setAll(true)}
        >
          See all
        </Button>
      )}
    </PageSection>
  )
}
