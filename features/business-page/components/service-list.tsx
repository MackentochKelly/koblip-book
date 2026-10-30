"use client"

import { useState } from "react"
import Image from "next/image"

import { useMessages } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { PageSection } from "@/components/page-section"
import { ResponsivePanel } from "@/components/responsive-panel"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import type { Service } from "../types"
import { formatDuration } from "@/lib/format-duration"
import { formatPrice } from "@/lib/format-price"
import { BookButton } from "./book-button"

// How many services the page shows before See all, which opens them all.
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
  const m = useMessages()
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
            ? m.booking.free
            : formatPrice(service.priceMinor, currency, m.locale)}
        </p>
      )}
    </>
  )
}

// What the business sells, like Fresha: a few cards, then See all. With
// booking on, each card has its own Book button.
export function ServiceList({
  services,
  currency,
  slug,
  bookable,
}: {
  services: Service[]
  currency: string
  slug: string
  bookable: boolean
}) {
  const m = useMessages()
  const [all, setAll] = useState(false)
  if (services.length === 0) return null
  const more = services.length > SERVICES_PREVIEW
  const items = (list: Service[]) => (
    <ServiceItems
      services={list}
      currency={currency}
      slug={slug}
      bookable={bookable}
    />
  )
  return (
    // A gray band like Fresha's: edge to edge on a phone, a rounded box on a
    // computer, with the white service cards on it.
    <PageSection
      id="services"
      title={m.sections.services}
      className="-mx-4 bg-muted px-4 py-6 dark:bg-card md:mx-0 md:rounded-2xl md:p-6"
    >
      {items(services.slice(0, SERVICES_PREVIEW))}
      {more && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setAll(true)}
        >
          {m.page.seeAll}
        </Button>
      )}
      {/* See all: every service in the shared panel (a bottom sheet on a
          phone, a dialog on a computer). */}
      <ResponsivePanel
        open={all}
        onClose={() => setAll(false)}
        title={m.sections.services}
      >
        {items(services)}
      </ResponsivePanel>
    </PageSection>
  )
}

function ServiceItems({
  services,
  currency,
  slug,
  bookable,
}: {
  services: Service[]
  currency: string
  slug: string
  bookable: boolean
}) {
  const m = useMessages()
  return (
    <ItemGroup className="gap-3">
      {services.map((service) => (
        <Item key={service.id} variant="outline" className="bg-background">
          {service.photoUrl && (
            <ItemMedia variant="image" className="size-16">
              <Image
                src={service.photoUrl}
                alt=""
                width={64}
                height={64}
                unoptimized
              />
            </ItemMedia>
          )}
          <ItemContent>
            <ItemTitle>
              <span className="truncate text-base font-semibold">
                {service.name}
              </span>
            </ItemTitle>
            <ServiceFacts service={service} currency={currency} />
          </ItemContent>
          {bookable && (
            <ItemActions>
              <BookButton
                slug={slug}
                serviceId={service.id}
                label={m.actions.book}
                variant="outline"
                size="sm"
              />
            </ItemActions>
          )}
        </Item>
      ))}
    </ItemGroup>
  )
}
