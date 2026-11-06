import "server-only"
import { createHash, randomBytes } from "node:crypto"

// A booking made signed out joins an account through a one-time secret
// kept only in the booker's tab: the booking stores its SHA-256, never the
// secret, so the database alone can't claim it.
export function newBookingClaim(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url")
  return { token, hash: bookingClaimHash(token) }
}

export function bookingClaimHash(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
