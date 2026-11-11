import type { PaymentBadgeState } from "@/lib/payment-rules"

export interface MyBooking {
  id: string
  serviceName: string
  startAt: string
  endAt: string
  customerName: string
  status: string
  // Paying outside the app, when the booking tracks it: how and where it
  // stands. Never the instructions or the customer's reference, which are
  // the owner's.
  // proof: there is a payment picture this member may open.
  // A reward was redeemed on it (docs/plans/rewards.md, RW-12).
  reward: boolean
  // paidOnline: what the card paid when booking and was not given back,
  // already as text ("$10.00"); null when nothing was.
  payment: {
    way: string | null
    status: PaymentBadgeState
    proof: boolean
    paidOnlineMinor: number | null
    currency: string
  } | null
}
