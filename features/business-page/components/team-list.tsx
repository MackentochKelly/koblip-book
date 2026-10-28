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
            className="flex w-16 flex-col items-center gap-1.5"
          >
            <Avatar size="lg" className="size-12">
              {member.photoUrl && <AvatarImage src={member.photoUrl} alt="" />}
              <AvatarFallback>{initials(member.name)}</AvatarFallback>
            </Avatar>
            <span className="line-clamp-2 text-center text-xs leading-tight">
              {member.name}
            </span>
          </div>
        ))}
      </div>
    </PageSection>
  )
}
