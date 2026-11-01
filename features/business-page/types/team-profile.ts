import type { BusinessPageData, Service, TeamMember } from "../types"

// What a team member's public profile shows (docs/plans/team-accounts.md).
export interface TeamProfilePage {
  data: BusinessPageData
  member: TeamMember & { about: string | null; languages: string[] }
  // The services they do.
  services: Service[]
  // Bookings with them that took place, and how many customers those were.
  appointments: number
  clients: number
}
