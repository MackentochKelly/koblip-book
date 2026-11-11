import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { businesses, emailBlocks } from "@/lib/db/schema"
import { normalEmail } from "@/lib/email-rules"

// "Stop emails" (docs/plans/email.md, EM-D10): each customer email ends
// with a link that stops that business's emails to that address. The link
// carries the address and the business, signed with the app's secret, so
// nobody can stop someone else's emails by changing it. It never expires:
// an old email's link still works.
//
// The link opens a page that asks first (GET never stops anything, so a
// mail scanner opening links stops nothing); mail apps' own unsubscribe
// button posts to the API route (RFC 8058, one click).

type Stop = { email: string; businessId: string }

// Its own key, made from the app's secret with a label, so a signature here
// is never valid anywhere else.
function signature(payload: string): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set")
  const key = createHmac("sha256", secret).update("email-stop").digest()
  return createHmac("sha256", key).update(payload).digest()
}

export function stopToken(email: string, businessId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ e: normalEmail(email), b: businessId })
  ).toString("base64url")
  return `${payload}.${signature(payload).toString("base64url")}`
}

// The address and business a token names, when its signature is right.
export function readStopToken(token: string | null | undefined): Stop | null {
  if (!token) return null
  const [payload, signed, extra] = token.split(".")
  if (!payload || !signed || extra !== undefined) return null
  const given = Buffer.from(signed, "base64url")
  const expected = signature(payload)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null
  }
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      e?: unknown
      b?: unknown
    }
    return typeof value.e === "string" && typeof value.b === "string"
      ? { email: value.e, businessId: value.b }
      : null
  } catch {
    return null
  }
}

// The page that asks, and the route mail apps post to.
export function stopLinks(email: string, businessId: string) {
  const base = process.env.BETTER_AUTH_URL ?? ""
  const token = encodeURIComponent(stopToken(email, businessId))
  return {
    page: `${base}/email/stop?t=${token}`,
    oneClick: `${base}/api/email/stop?t=${token}`,
  }
}

// What the page shows before the tap: the address and the business's name.
export async function stopRequest(
  token: string | null | undefined
): Promise<(Stop & { businessName: string }) | null> {
  const stop = readStopToken(token)
  if (!stop) return null
  const [business] = await db
    .select({ name: businesses.name })
    .from(businesses)
    .where(eq(businesses.id, stop.businessId))
    .limit(1)
  return business ? { ...stop, businessName: business.name } : null
}

// Stops that business's emails to that address. Doing it twice changes
// nothing. False when the token is wrong or the business is gone.
export async function stopEmails(token: string | null | undefined): Promise<boolean> {
  const stop = await stopRequest(token)
  if (!stop) return false
  await db
    .insert(emailBlocks)
    .values({ email: stop.email, businessId: stop.businessId, reason: "stopped" })
    .onConflictDoNothing()
  return true
}
