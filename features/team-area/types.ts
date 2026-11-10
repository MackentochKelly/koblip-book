import type { PaymentStatus } from "@/lib/payment-rules"

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
  payment: { way: string | null; status: PaymentStatus; proof: boolean } | null
}
