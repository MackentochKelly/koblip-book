import { PageSection } from "@/components/page-section"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { TeamMember } from "../types"

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

export function TeamList({ team }: { team: TeamMember[] }) {
  if (team.length === 0) {
    return null
  }
  return (
    <PageSection id="team" title="Team">
      <div className="flex flex-wrap gap-4">
        {team.map((member) => (
          <div
            key={member.id}
            className="flex w-16 flex-col items-center gap-1.5"
          >
            <Avatar size="lg">
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
