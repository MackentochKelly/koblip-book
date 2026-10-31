"use server"

import { db } from "@/lib/db"
import { googleCalendarConnections } from "@/lib/db/schema"
import { endGoogleCalendarConnection } from "@/lib/google-calendar"
import { businessConnectionWhere } from "./google-calendar"
import { getOwnerBusiness } from "./queries"

// Disconnect on the Integrations page: ends the connection at Google and
// forgets its tokens here. The "Koblip Book" calendar stays in Google (G10
// lets the owner remove its events).
export async function disconnectGoogleCalendar(
  businessId: string
): Promise<{ ok: true }> {
  await getOwnerBusiness(businessId)
  const [row] = await db
    .select({ id: googleCalendarConnections.id })
    .from(googleCalendarConnections)
    .where(businessConnectionWhere(businessId))
    .limit(1)
  if (row) await endGoogleCalendarConnection(row.id)
  return { ok: true }
}
