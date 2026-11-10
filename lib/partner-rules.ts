// Apps that bring businesses to Koblip Book through its partner API
// (docs/plans/sales-connection.md).

export const PARTNER_RULES = {
  // An invite link works this many days after it was made (SC4).
  inviteDays: 30,
  // Invites an app may ask for each day until the admin sets its own cap (SC5).
  defaultDailyInvites: 50,
  // The highest cap the admin can set.
  maxDailyInvites: 1000,
  // The longest app name and lead reference.
  maxName: 60,
  maxRef: 100,
  // The longest webhook address.
  maxUrl: 500,
  // A failed event is sent again after this many minutes (SC7)...
  retryMinutes: 10,
  // ...until it has been tried this many times.
  maxAttempts: 12,
  // A webhook answer is awaited this long (ms).
  sendTimeoutMs: 10_000,
  // A signed event older or newer than this is refused (seconds).
  signatureToleranceSeconds: 300,
  // The admin's lists show this many rows.
  listed: 100,
} as const

// What an invite is now: open (link works), claimed (its business has an
// owner), ended (past its days), revoked (its app was revoked).
export const PARTNER_INVITE_STATES = [
  "open",
  "claimed",
  "ended",
  "revoked",
] as const
export type PartnerInviteState = (typeof PARTNER_INVITE_STATES)[number]

export function inviteState(
  invite: { claimedAt: string | null; endsAt: string },
  revoked: boolean,
  now: number = Date.now()
): PartnerInviteState {
  if (invite.claimedAt) return "claimed"
  if (revoked) return "revoked"
  return Date.parse(invite.endsAt) <= now ? "ended" : "open"
}

// The events an app receives (SC7).
export const PARTNER_EVENT_TYPES = [
  "invite.opened",
  "invite.claimed",
  "plan.started",
] as const
export type PartnerEventType = (typeof PARTNER_EVENT_TYPES)[number]

export const PARTNER_EVENT_STATES = ["pending", "sent", "failed"] as const
export type PartnerEventState = (typeof PARTNER_EVENT_STATES)[number]

// Google place IDs: letters, digits, _ and -.
export const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,300}$/

// A webhook address an app may give: https, or plain http to this machine
// while developing (`local` is true outside production).
export function validWebhookUrl(value: string, local: boolean): boolean {
  if (value.length > PARTNER_RULES.maxUrl) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.username || url.password) return false
  if (url.protocol === "https:") return true
  return (
    local &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
}
