import "server-only"

import { eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  businesses,
  businessPhotos,
  googleCalendarConnections,
  services,
  teamMembers,
} from "@/lib/db/schema"
import { endGoogleCalendarConnection } from "@/lib/google-calendar"
import { deletePhoto } from "@/lib/uploads"
import { endChatConnection } from "./chat-oauth"

// Every business an account owns, demo copies too.
export async function ownedBusinessIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.ownerId, userId))
  return rows.map((row) => row.id)
}

// Deletes businesses for good with everything in them. What lives outside
// ends first, as Disconnect does: every Google Calendar connection (the
// business's and its team's) and the Koblip Chat connection. Then the rows
// go in one delete (every table with a business id cascades), then the
// photo files.
export async function deleteBusinesses(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return
  }
  const [connections, photos, servicePhotos, memberPhotos] = await Promise.all([
    db
      .select({ id: googleCalendarConnections.id })
      .from(googleCalendarConnections)
      .where(inArray(googleCalendarConnections.businessId, ids)),
    db
      .select({ url: businessPhotos.url })
      .from(businessPhotos)
      .where(inArray(businessPhotos.businessId, ids)),
    db
      .select({ url: services.photoUrl })
      .from(services)
      .where(inArray(services.businessId, ids)),
    db
      .select({ url: teamMembers.photoUrl })
      .from(teamMembers)
      .where(inArray(teamMembers.businessId, ids)),
  ])
  for (const connection of connections) {
    await endGoogleCalendarConnection(connection.id)
  }
  for (const id of ids) {
    await endChatConnection(id)
  }
  await db.delete(businesses).where(inArray(businesses.id, ids))
  // A file left behind is only disk space; the business is already gone.
  await Promise.all(
    [...photos, ...servicePhotos, ...memberPhotos].map((row) =>
      deletePhoto(row.url).catch(() => undefined)
    )
  )
}
