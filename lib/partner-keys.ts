import "server-only"

import { createHash, randomBytes } from "node:crypto"

// The partner API's secrets (docs/plans/sales-connection.md, SC2, SC6):
// API keys and invite codes are 32 random bytes, shown once and stored
// only as a SHA-256 hash; the event secret is kept, since Book signs with it.

const random = () => randomBytes(32).toString("base64url")

export const hashSecret = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex")

// `kbk_` marks a Koblip Book key, so it is easy to spot in a leak scan.
export function newApiKey(): { key: string; hash: string; hint: string } {
  const key = `kbk_${random()}`
  return { key, hash: hashSecret(key), hint: key.slice(-4) }
}

export const newEventSecret = (): string => `kbe_${random()}`

export function newInviteCode(): { code: string; hash: string } {
  const code = random()
  return { code, hash: hashSecret(code) }
}

// An invite code as links carry it: 43 base64url characters.
export const INVITE_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/
