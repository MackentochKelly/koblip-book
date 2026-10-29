import "server-only"

import { and, eq, inArray, lt } from "drizzle-orm"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  account,
  addonGroups,
  addonOptions,
  assistantActions,
  assistantConversations,
  bookingAddons,
  bookings,
  businesses,
  businessHours,
  businessPhotos,
  serviceAddonGroups,
  services,
  session,
  teamMemberServices,
  teamMembers,
  translations,
  user,
} from "@/lib/db/schema"
import { DEMO_RULES } from "@/lib/demo-rules"

// Deletes demo copies older than DEMO_RULES.keepHours with everything in
// them, and the demo guests from that long ago with their sessions. Rows
// go table by table (the database does not cascade deletes), all in one
// batch. Runs whenever a new copy opens, like the onboarding purge. Never
// throws: a purge failure only logs.
export async function purgeOldDemos(now: number = Date.now()): Promise<void> {
  try {
    const cutoff = now - DEMO_RULES.keepHours * 3_600_000
    const [stale, guests] = await Promise.all([
      db
        .select({ id: businesses.id })
        .from(businesses)
        .where(
          and(
            eq(businesses.isDemo, true),
            lt(businesses.createdAt, new Date(cutoff).toISOString())
          )
        ),
      db
        .select({ id: user.id })
        .from(user)
        .where(
          and(eq(user.isAnonymous, true), lt(user.createdAt, new Date(cutoff)))
        ),
    ])
    const ids = stale.map((row) => row.id)
    const guestIds = guests.map((row) => row.id)
    await saveAll([
      ...(ids.length > 0
        ? [
            db
              .delete(bookingAddons)
              .where(inArray(bookingAddons.businessId, ids)),
            db.delete(bookings).where(inArray(bookings.businessId, ids)),
            db
              .delete(teamMemberServices)
              .where(inArray(teamMemberServices.businessId, ids)),
            db
              .delete(serviceAddonGroups)
              .where(inArray(serviceAddonGroups.businessId, ids)),
            db
              .delete(addonOptions)
              .where(inArray(addonOptions.businessId, ids)),
            db.delete(addonGroups).where(inArray(addonGroups.businessId, ids)),
            db.delete(services).where(inArray(services.businessId, ids)),
            db.delete(teamMembers).where(inArray(teamMembers.businessId, ids)),
            db
              .delete(businessHours)
              .where(inArray(businessHours.businessId, ids)),
            db
              .delete(businessPhotos)
              .where(inArray(businessPhotos.businessId, ids)),
            db
              .delete(translations)
              .where(inArray(translations.businessId, ids)),
            db
              .delete(assistantActions)
              .where(inArray(assistantActions.businessId, ids)),
            db
              .delete(assistantConversations)
              .where(inArray(assistantConversations.businessId, ids)),
            db.delete(businesses).where(inArray(businesses.id, ids)),
          ]
        : []),
      ...(guestIds.length > 0
        ? [
            db.delete(session).where(inArray(session.userId, guestIds)),
            db.delete(account).where(inArray(account.userId, guestIds)),
            db.delete(user).where(inArray(user.id, guestIds)),
          ]
        : []),
    ])
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
  }
}
