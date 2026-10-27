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
}
export type OwnerBookingResult =
  | { status: "booked"; bookingId: string }
  | { status: "conflict"; reason: "closed" | "busy" }
  | { status: "invalid"; field: "service" | "teamMember" | "addons" | "date" | "time" | "name" | "phone" | "note" }
  | { status: "failed" }
