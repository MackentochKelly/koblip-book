import Link from "next/link"

import { BottomBar } from "@/components/bottom-bar"
import { LanguageMenu } from "@/components/language-menu"
import { PageSection } from "@/components/page-section"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/ui/icons"
import { messagesFor } from "@/lib/i18n"
import { initials } from "@/lib/initials"
import type { PageLanguage } from "@/lib/page-language"
import { languageName } from "@/lib/team-rules"
import type { TeamProfilePage } from "../types/team-profile"
import { BookButton } from "./book-button"
import { ServiceList } from "./service-list"

// A team member's own page, like Fresha's: their photo, name and job title,
// what they have done here, about them, the languages they speak, and the
// services they do, each bookable with them already picked.
export function TeamProfile({
  profile,
  language,
  bookable,
}: {
  profile: TeamProfilePage
  language: PageLanguage
  bookable: boolean
}) {
  const m = messagesFor(language)
  const t = m.teamProfile
  const { data, member, services } = profile
  const { business } = data
  const number = new Intl.NumberFormat(m.locale)
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
            <span className="truncate">{m.policies.backTo(business.name)}</span>
          </Button>
          <div className="flex shrink-0 gap-2">
            <ThemeToggle />
            <LanguageMenu />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <Avatar className="size-32">
            {member.photoUrl && <AvatarImage src={member.photoUrl} alt="" />}
            <AvatarFallback className="text-4xl">{initials(member.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{member.name}</h1>
            {member.description && <p className="text-muted-foreground">{member.description}</p>}
            <p className="text-sm text-muted-foreground">{business.name}</p>
          </div>
          {bookable && (
            <BookButton
              slug={business.slug}
              memberId={member.id}
              fromAway
              className="max-md:hidden"
            />
          )}
        </div>

        {profile.appointments > 0 && (
          <dl className="flex flex-col gap-3">
            <div className="flex justify-between gap-4">
              <dt>{t.appointments}</dt>
              <dd className="text-muted-foreground">{number.format(profile.appointments)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t.clients}</dt>
              <dd className="text-muted-foreground">{number.format(profile.clients)}</dd>
            </div>
          </dl>
        )}

        {member.about && (
          <PageSection id="about" title={t.about}>
            <p className="whitespace-pre-line text-muted-foreground">{member.about}</p>
          </PageSection>
        )}

        {member.languages.length > 0 && (
          <PageSection id="languages" title={t.languages}>
            <div className="flex flex-wrap gap-2">
              {member.languages.map((code) => (
                <Badge key={code} variant="secondary">
                  {languageName(code, m.locale)}
                </Badge>
              ))}
            </div>
          </PageSection>
        )}

        <ServiceList
          services={services}
          currency={business.currency}
          slug={business.slug}
          bookable={bookable}
          memberId={member.id}
          fromAway
        />
      </main>
      {bookable && (
        <BottomBar label={m.actions.bookNow} className="md:hidden">
          <BookButton slug={business.slug} memberId={member.id} fromAway className="flex-1" />
        </BottomBar>
      )}
    </>
  )
}
