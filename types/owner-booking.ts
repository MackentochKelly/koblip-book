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
  language?: "en" | "es" // the language their messages go in
}
export type OwnerBookingResult =
  | { status: "booked"; bookingId: string }
  | { status: "conflict"; reason: "closed" | "busy" }
  | { status: "invalid"; field: "service" | "teamMember" | "addons" | "date" | "time" | "name" | "phone" | "note" }
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
