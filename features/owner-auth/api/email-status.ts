"use server"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { user } from "@/lib/db/auth-schema"

// Email-first login: tells the UI whether to show "password" (existing
// account) or "name + new password" (new account). Better Auth stores and
// compares emails lowercase, so the lookup matches the same way.
export async function emailStatus(
  email: string
): Promise<{ ok: true; exists: boolean } | { ok: false }> {
  if (typeof email !== "string") {
    return { ok: false }
  }
  const normalized = email.trim().toLowerCase()
  if (
    normalized.length < 3 ||
    normalized.length > 254 ||
    !normalized.includes("@")
  ) {
    return { ok: false }
  }
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1)
  return { ok: true, exists: row !== undefined }
}
