import type { PageLanguage } from "@/lib/page-language"

export interface OwnerBookingInput {
  businessId: string
  serviceId: string
  teamMemberId: string | null // null = anyone free (or no team)
  addonIds: string[]
  date: string // "YYYY-MM-DD", business time zone
  time: string // "HH:mm", business time zone
  name: string
  phone: string | null
  note: string | null
  allowConflict: boolean // true = the owner said "Book anyway"
  whatsappOptIn?: boolean // the customer agreed to WhatsApp booking messages
  language?: PageLanguage // the language their messages go in
  rewardId?: string | null // the customer's reward to redeem (docs/plans/rewards.md, RW8)
}
export type OwnerBookingResult =
  | { status: "booked"; bookingId: string }
  | { status: "conflict"; reason: "closed" | "busy" }
  | {
      status: "invalid"
      field:
        | "service"
        | "teamMember"
        | "addons"
        | "date"
        | "time"
        | "name"
        | "phone"
        | "note"
        | "reward"
    }
  | { status: "failed" }
// The owner moves a booking that has not started to another day or time.
export interface OwnerMoveInput {
  businessId: string
  bookingId: string
  date: string // "YYYY-MM-DD", business time zone
  time: string // "HH:mm", business time zone
  allowConflict: boolean // true = the owner said "Move anyway"
}
export type OwnerMoveResult =
  | { status: "moved" }
  | { status: "conflict"; reason: "closed" | "busy" }
  | { status: "invalid"; field: "date" | "time" }
  | { status: "failed" }
// The free times the owner can pick from when adding a booking: the same
// ones the booking page offers. null = none to offer (not bookable online).
export interface OwnerFreeTimesInput {
  businessId: string
  serviceId: string
  teamMemberId: string | null // null = anyone free
  addonIds: string[]
}
export type OwnerFreeTimes = {
  days: { date: string; times: string[] }[] // "YYYY-MM-DD", "HH:mm", business time zone
} | null
export interface OwnerMoveFreeTimesInput {
  businessId: string
  bookingId: string
}
