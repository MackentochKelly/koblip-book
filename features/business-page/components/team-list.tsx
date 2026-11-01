import Link from "next/link"

import { PageSection } from "@/components/page-section"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { messagesFor } from "@/lib/i18n"
import { initials } from "@/lib/initials"
import type { PageLanguage } from "@/lib/page-language"
import type { TeamMember } from "../types"

// The team, like Fresha: each person opens their own profile.
export function TeamList({
  slug,
  team,
  language,
}: {
  slug: string
  team: TeamMember[]
  language: PageLanguage
}) {
  if (team.length === 0) {
    return null
  }
  return (
    <PageSection id="team" title={messagesFor(language).sections.team}>
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
            <Avatar className="size-18">
              {member.photoUrl && <AvatarImage src={member.photoUrl} alt="" />}
              <AvatarFallback className="text-xl">
                {initials(member.name)}
              </AvatarFallback>
            </Avatar>
            <span className="flex flex-col items-center gap-0.5 text-center">
              <span className="line-clamp-2 text-sm leading-tight">{member.name}</span>
              {member.description && (
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {member.description}
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </PageSection>
  )
}
