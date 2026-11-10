import { useTranslations } from "next-intl"

import { PaymentBadge } from "@/components/payment-badge"
import type { PaymentStatus } from "@/lib/payment-rules"

// Where a booking's payment stands, in the owner's words: not paid, the
// customer says they paid (check it), or paid.
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations("owner.bookings.payment.status")
  return <PaymentBadge status={status} label={t(status)} />
}
