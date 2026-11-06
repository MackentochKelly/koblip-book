import Image from "next/image"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import { BottomBar } from "@/components/bottom-bar"
import { LanguageMenu } from "@/components/language-menu"
import { PageSection } from "@/components/page-section"
import { Rating } from "@/components/rating"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/ui/icons"
import { initials } from "@/lib/initials"
import { languageOf } from "@/lib/page-language"
import { languageName } from "@/lib/team-rules"
import type { TeamProfilePage } from "../types/team-profile"
import { BookButton } from "./book-button"
import { BusinessDetails, detailSections } from "./business-details"
import { BusinessFooter } from "./business-footer"
import { SectionTabs } from "./section-tabs"
import { ServiceList } from "./service-list"
import { ShareButton } from "./share-button"

// A team member's own page, like Fresha: their photo over the business's
// cover, name, job title and the business's rating, what they have done
// here, about them, the languages they speak and the services they do,
// each bookable with them already picked; then their own hours and the
// business's reviews, photos, About, info and location.
export function TeamProfile({
  profile,
  bookable,
}: {
  profile: TeamProfilePage
  bookable: boolean
}) {
  const m = useTranslations("public")
  const t = useTranslations("public.teamProfile")
  const locale = useLocale()
  const language = languageOf(locale)
  const { data, member, services } = profile
  const { business } = data
  const number = new Intl.NumberFormat(locale)
  const firstName = member.name.split(" ")[0] || member.name
  const cover = data.photos[0]
  const hoursTitle = t("hours", { name: firstName })
  const sections = [
    ...(services.length > 0 ? [{ id: "services", label: m("sections.services") }] : []),
    ...detailSections(data, (section) => m(`sections.${section}`), hoursTitle),
  ]
  return (
    <>
      <main
        lang={language}
        className="mx-auto flex w-full max-w-prose flex-col gap-8 px-4 pt-4 pb-32 md:pt-8 md:pb-12"
      >
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            // Gives way so a long business name truncates.
            className="-ml-2.5 min-w-0 shrink"
            nativeButton={false}
            render={<Link href={`/b/${business.slug}?lang=${language}#team`} />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            <span className="truncate">{m("policies.backTo", { name: business.name })}</span>
          </Button>
          <div className="flex shrink-0 gap-2">
            <ThemeToggle />
            <LanguageMenu />
            <ShareButton title={`${member.name} · ${business.name}`} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          {/* The business's first photo as a cover, their photo over its
              lower edge. */}
          <div className="relative aspect-3/1 w-full overflow-hidden rounded-2xl bg-muted">
            {cover && (
              <Image
                src={cover.url}
                alt=""
                fill
                unoptimized
                priority
                sizes="(max-width: 768px) 100vw, 40rem"
                className="object-cover"
              />
            )}
          </div>
          <Avatar className="-mt-16 size-28 ring-4 ring-background">
            {member.photoUrl && <AvatarImage src={member.photoUrl} alt="" />}
            <AvatarFallback className="text-3xl">{initials(member.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{member.name}</h1>
            {member.description && <p className="text-muted-foreground">{member.description}</p>}
            <p className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-muted-foreground">
              {business.name}
              {business.rating !== null && (
                <Rating
                  rating={business.rating}
                  reviewCount={business.reviewCount}
                  locale={locale}
                />
              )}
            </p>
          </div>
          {/* What they have done here: two small numbers, side by side. */}
          {profile.appointments > 0 && (
            <dl className="flex items-center justify-center">
              {[
                { label: t("appointments"), value: profile.appointments },
                { label: t("clients"), value: profile.clients },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center px-5 not-first:border-l"
                >
                  <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                  <dd className="order-first text-lg font-semibold tabular-nums">
                    {number.format(stat.value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {bookable && (
            <BookButton
              slug={business.slug}
              memberId={member.id}
              fromAway
              className="max-md:hidden"
            />
          )}
        </div>

        {member.about && (
          <PageSection id="about-me" title={t("about", { name: firstName })}>
            <p className="whitespace-pre-line text-muted-foreground">{member.about}</p>
          </PageSection>
        )}

        {member.languages.length > 0 && (
          <PageSection id="languages" title={t("languages")}>
            <div className="flex flex-wrap gap-2">
              {member.languages.map((code) => (
                <Badge key={code} variant="secondary">
                  {languageName(code, locale)}
                </Badge>
              ))}
            </div>
          </PageSection>
        )}

        <SectionTabs sections={sections} />
        <ServiceList
          services={services}
          serviceCategories={data.serviceCategories}
          currency={business.currency}
          slug={business.slug}
          bookable={bookable}
          memberId={member.id}
          fromAway
        />
        <BusinessDetails
          data={data}
          hours={{ rows: profile.hours, title: hoursTitle }}
        />
        <BusinessFooter
          name={business.name}
          slug={business.slug}
          policies={data.policies}
          fromGoogle={business.googlePlaceId !== null}
        />
      </main>
      {bookable && (
        <BottomBar label={m("actions.bookNow")} className="md:hidden">
          <BookButton slug={business.slug} memberId={member.id} fromAway className="flex-1" />
        </BottomBar>
      )}
    </>
  )
}
