import { Badge } from "@/components/ui/badge"
import type { PaymentStatus } from "@/lib/payment-rules"

const VARIANTS = {
  unpaid: "secondary",
  reported: "warning",
  paid: "success",
} as const

// Where a booking's payment stands (lib/payment-rules.ts): not paid, the
// customer says they paid, or paid. One look in the owner area, the team
// area and the customer's account; each gives its own words, which carry
// the meaning, not the colour alone.
export function PaymentBadge({
  status,
  label,
}: {
  status: PaymentStatus
  label: string
}) {
  return <Badge variant={VARIANTS[status]}>{label}</Badge>
}
