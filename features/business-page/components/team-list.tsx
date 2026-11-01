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
      <div className="flex flex-wrap gap-4">
        {team.map((member) => (
          <div
            key={member.id}
            className="flex w-24 flex-col items-center gap-2"
          >
            <Avatar className="size-20">
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
