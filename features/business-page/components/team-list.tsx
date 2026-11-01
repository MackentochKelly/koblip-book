import { PageSection } from "@/components/page-section"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { messagesFor } from "@/lib/i18n"
import { initials } from "@/lib/initials"
import type { PageLanguage } from "@/lib/page-language"
import type { TeamMember } from "../types"

export function TeamList({
  team,
  language,
}: {
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
          <div
            key={member.id}
            className="flex w-20 shrink-0 flex-col items-center gap-2"
          >
            <Avatar className="size-18">
              {member.photoUrl && <AvatarImage src={member.photoUrl} alt="" />}
              <AvatarFallback className="text-xl">
                {initials(member.name)}
              </AvatarFallback>
            </Avatar>
            <span className="line-clamp-2 text-center text-sm leading-tight">
              {member.name}
            </span>
          </div>
        ))}
      </div>
    </PageSection>
  )
}
