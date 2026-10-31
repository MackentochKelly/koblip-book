import "server-only"

import { and, inArray, isNull, lt } from "drizzle-orm"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { businessHours, businesses, teamMemberHours } from "@/lib/db/schema"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"

// Deletes imports nobody claimed and nobody confirmed that are older than
// ONBOARDING_RULES.unclaimedImportHours, with their hours. Never deletes a
// business that has an owner. Never throws: a purge failure only logs.
export async function purgeUnclaimedImports(
  now: number = Date.now()
): Promise<void> {
  try {
    const cutoff = new Date(
      now - ONBOARDING_RULES.unclaimedImportHours * 3_600_000
    ).toISOString()
    const stale = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(
        and(
          isNull(businesses.ownerId),
          isNull(businesses.detailsConfirmedAt),
          lt(businesses.createdAt, cutoff)
        )
      )
    if (stale.length === 0) {
      return
    }
    const ids = stale.map((row) => row.id)
    await saveAll([
      db.delete(teamMemberHours).where(inArray(teamMemberHours.businessId, ids)),
      db.delete(businessHours).where(inArray(businessHours.businessId, ids)),
      db.delete(businesses).where(inArray(businesses.id, ids)),
    ])
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
  }
}
