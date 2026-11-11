import { Badge } from "@/components/ui/badge"
import type { PaymentBadgeState } from "@/lib/payment-rules"

const VARIANTS = {
  unpaid: "secondary",
  reported: "warning",
  paid: "success",
  // By card (docs/plans/online-payments.md): a part is paid, or all of it
  // was given back.
  deposit: "success",
  refunded: "secondary",
} as const

// Where a booking's payment stands (lib/payment-rules.ts): not paid, the
// customer says they paid, or paid. One look in the owner area, the team
// area and the customer's account; each gives its own words, which carry
// the meaning, not the colour alone.
export function PaymentBadge({
  status,
  label,
}: {
  status: PaymentBadgeState
  label: string
}) {
  return <Badge variant={VARIANTS[status]}>{label}</Badge>
}
