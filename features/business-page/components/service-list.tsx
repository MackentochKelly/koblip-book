"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import Image from "next/image"

import { PageSection } from "@/components/page-section"
import { ViewTabs } from "@/components/view-tabs"
import { useFormatDuration } from "@/hooks/use-format-duration"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import type { Service, ServiceCategory } from "../types"
import { formatPrice } from "@/lib/format-price"
import { groupServices, showsGroups } from "@/lib/service-groups"
import { BookButton } from "./book-button"

// How many services the page shows before See all, which opens booking.
const SERVICES_PREVIEW = 3

// The tab of the services in no category; category ids never take it.
const OTHER = "other"

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
  const t = useTranslations("public.booking")
  const locale = useLocale()
  const formatDuration = useFormatDuration()
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
            ? t("free")
            : formatPrice(service.priceMinor, currency, locale)}
        </p>
      )}
    </>
  )
}

// What the business sells, like Fresha: a few cards, then See all. With
// booking on, each card has its own Book button. On a team member's profile
// the buttons book with them (`memberId`), from that page (`fromAway`).
// With two or more groups of services (docs/plans/service-categories.md),
// tabs over the cards show one group's first few at a time.
export function ServiceList({
  services,
  serviceCategories,
  currency,
  slug,
  bookable,
  memberId,
  fromAway,
}: {
  services: Service[]
  serviceCategories: ServiceCategory[]
  currency: string
  slug: string
  bookable: boolean
  memberId?: string
  fromAway?: boolean
}) {
  const t = useTranslations("public")
  const groups = groupServices(services, serviceCategories)
  const tabs =
    showsGroups(groups) && groups.length >= 2
      ? groups.map((group) => ({
          id: group.category?.id ?? OTHER,
          label: group.category?.name ?? t("sections.otherServices"),
          services: group.services,
        }))
      : null
  const [picked, setPicked] = useState<string | null>(null)
  if (services.length === 0) return null
  const tab = tabs && (tabs.find((item) => item.id === picked) ?? tabs[0])
  const shown = (tab ? tab.services : services).slice(0, SERVICES_PREVIEW)
  const more = services.length > shown.length
  return (
    // A gray band like Fresha's: edge to edge on a phone, a rounded box on a
    // computer, with the white service cards on it.
    <PageSection
      id="services"
      title={t("sections.services")}
      className="-mx-4 bg-muted px-4 py-6 dark:bg-card md:mx-0 md:rounded-2xl md:p-6"
    >
      {tabs && tab && (
        <ViewTabs
          views={tabs}
          value={tab.id}
          onChange={setPicked}
          ariaLabel={t("sections.serviceCategories")}
          variant="chips"
        />
      )}
      <ItemGroup className="gap-3">
        {shown.map((service) => (
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
                  memberId={memberId}
                  fromAway={fromAway}
                  label={t("actions.book")}
                  variant="outline"
                  size="default"
                />
              </ItemActions>
            )}
          </Item>
        ))}
      </ItemGroup>
      {/* See all opens the same booking sheet (page on a computer) as Book
          now, which starts on the choice of service. */}
      {more && (
        <BookButton
          slug={slug}
          memberId={memberId}
          fromAway={fromAway}
          label={t("page.seeAll")}
          variant="outline"
          size="lg"
        />
      )}
    </PageSection>
  )
}
