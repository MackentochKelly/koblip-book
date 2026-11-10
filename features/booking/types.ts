import type { PageLanguage } from "@/lib/page-language"
import type { BookingPayment, PaymentRequest } from "@/lib/payment-rules"

export interface AvailabilityDay { date: string; times: string[] } // date "YYYY-MM-DD", times "HH:mm", business time zone
export interface Availability { days: AvailabilityDay[] }
export interface BookingInput { slug: string; serviceId: string; teamMemberId: string | null; addonIds: string[]; date: string; time: string; name: string; phone: string; language?: PageLanguage
  // The customer ticked the box agreeing to the business's policies; needed
  // whenever the business has any.
  acceptedPolicies?: boolean
  // How they will pay, needed whenever the business lists ways to pay
  // outside the app (lib/payment-rules.ts).
  payment?: PaymentRequest }
export interface BookingConfirmation {
  id: string; businessName: string; address: string | null; timeZone: string
  serviceName: string; teamMemberName: string | null; durationMinutes: number; priceMinor: number | null; currency: string
  date: string; time: string
  addons: { name: string; priceMinor: number | null; durationMinutes: number }[]
  // How they chose to pay, with the way's instructions: shown once, to the
  // person who just booked. Null when the business tracks no payment.
  payment: BookingPayment | null
}
export type BookingResult =
  // claimToken: booked signed out, the one-time secret that joins it to
  // the account logged in from "Manage your booking" (lib/booking-claim.ts).
  | { status: "booked"; booking: BookingConfirmation; claimToken: string | null }
  | { status: "taken" }
  | { status: "invalid"; field: "service" | "teamMember" | "addons" | "time" | "name" | "phone" | "policies" | "payment" }
  // The business asks for payment proof and none came, or the file was
  // refused (docs/plans/payment-proof.md, PP10).
  | { status: "invalid"; field: "proof"; error: "missing" | "too_big" | "wrong_type" }
  | { status: "failed" }
