import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import { PageSection } from "@/components/page-section"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initials } from "@/lib/initials"
import { languageOf } from "@/lib/page-language"
import type { TeamMember } from "../types"

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name
}

function lastName(name: string) {
  return name.trim().split(/\s+/).slice(1).join(" ")
}

// The team, like Fresha: each person opens their own profile.
export function TeamList({ slug, team }: { slug: string; team: TeamMember[] }) {
  const t = useTranslations("public.sections")
  const language = languageOf(useLocale())
  if (team.length === 0) {
    return null
  }
  return (
    <PageSection id="team" title={t("team")}>
      {/* One row that swipes sideways; on the phone it runs to the screen
          edges (the page's px-4, taken back by a negative margin). The
          swipe stays in the row instead of carrying on to the page. */}
      <div className="-mx-4 no-scrollbar flex scroll-fade-x gap-3 overflow-x-auto overscroll-x-contain px-4 md:mx-0 md:px-0">
        {team.map((member) => (
          <Link
            key={member.id}
            href={`/b/${slug}/team/${member.id}?lang=${language}`}
            className="flex w-20 shrink-0 flex-col items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <Avatar className="size-18 after:border-2 after:mix-blend-normal dark:after:mix-blend-normal">
              {member.photoUrl && <AvatarImage src={member.photoUrl} alt="" />}
              <AvatarFallback className="text-xl">
                {initials(member.name)}
              </AvatarFallback>
            </Avatar>
            {/* Like Fresha: the first name a little bold, then the job title
                in small grey (the last name stands in when there is none).
                Screen readers hear the full name in one piece. */}
            <span className="flex w-full flex-col items-center gap-0.5 text-center">
              <span className="sr-only">{member.name}</span>
              <span
                aria-hidden="true"
                className="w-full truncate text-sm leading-tight font-medium"
              >
                {firstName(member.name)}
              </span>
              {member.description ? (
                <span className="w-full truncate text-xs text-muted-foreground">
                  {member.description}
                </span>
              ) : (
                lastName(member.name) && (
                  <span
                    aria-hidden="true"
                    className="w-full truncate text-xs text-muted-foreground"
                  >
                    {lastName(member.name)}
                  </span>
                )
              )}
            </span>
          </Link>
        ))}
      </div>
    </PageSection>
  )
}
