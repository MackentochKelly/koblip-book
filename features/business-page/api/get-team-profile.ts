import "server-only"

import { cache } from "react"
import { and, countDistinct, count, eq, lt, notInArray, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { bookings, teamMemberHours, teamMembers } from "@/lib/db/schema"
import type { PageLanguage } from "@/lib/page-language"
import { getBusinessTranslations } from "@/lib/translations/business-texts"
import type { TeamProfilePage } from "../types/team-profile"
import { getBusinessPage } from "./get-business-page"

// A team member's public profile (docs/plans/team-accounts.md): the
// business page's data (its translated services, who does what), their
// About (translated when its translation is up to date) and languages,
// and what they have done here. Null when the business or the person
// doesn't exist.
async function loadTeamProfile(
  slug: string,
  memberId: string,
  language: PageLanguage
): Promise<TeamProfilePage | null> {
  const data = await getBusinessPage(slug, language)
  const member = data?.team.find((person) => person.id === memberId)
  if (!data || !member) return null
  const now = new Date().toISOString()
  const [[profile], [done], translated, ownHours] = await Promise.all([
    db
      .select({
        about: teamMembers.about,
        languages: teamMembers.languages,
        pastAppointments: teamMembers.pastAppointments,
        pastClients: teamMembers.pastClients,
      })
      .from(teamMembers)
      .where(eq(teamMembers.id, member.id))
      .limit(1),
    // Bookings with them that took place: ended, not cancelled or missed.
    // Customers count once each (by their key, else their name).
    db
      .select({
        appointments: count(),
        clients: countDistinct(
          sql`coalesce(${bookings.customerKey}, ${bookings.customerName})`
        ),
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.businessId, data.business.id),
          eq(bookings.teamMemberId, member.id),
          lt(bookings.endAt, now),
          notInArray(bookings.status, ["cancelled", "no_show"])
        )
      ),
    getBusinessTranslations(data.business.id, language),
    db
      .select({
        weekday: teamMemberHours.weekday,
        opensAt: teamMemberHours.opensAt,
        closesAt: teamMemberHours.closesAt,
      })
      .from(teamMemberHours)
      .where(eq(teamMemberHours.teamMemberId, member.id)),
  ])
  const about = profile?.about ?? null
  return {
    data,
    member: {
      ...member,
      about: about && translated(member.id, "team_member.about", about),
      languages: profile?.languages ?? [],
    },
    // The services they do: a service with no team list is everyone's.
    services: data.services.filter(
      (service) => data.serviceTeams[service.id]?.includes(member.id) ?? true
    ),
    // Plus their numbers from before Koblip (TEAM_RULES.startingCounts).
    appointments: (done?.appointments ?? 0) + (profile?.pastAppointments ?? 0),
    clients: (done?.clients ?? 0) + (profile?.pastClients ?? 0),
    hours: ownHours.length > 0 ? ownHours : data.hours,
  }
}

export const getTeamProfile = cache(loadTeamProfile)
