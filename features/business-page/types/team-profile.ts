import type { BusinessPageData, Service, TeamMember } from "../types"
import type { HourRow } from "../utils/group-hours"

// What a team member's public profile shows (docs/plans/team-accounts.md).
export interface TeamProfilePage {
  data: BusinessPageData
  member: TeamMember & { about: string | null; languages: string[] }
  // The services they do.
  services: Service[]
  // Bookings with them that took place, and how many customers those were,
  // each with their number from before Koblip added.
  appointments: number
  clients: number
  // The hours they work, or the business's when the owner set none.
  hours: HourRow[]
}
