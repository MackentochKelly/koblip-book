import {
  BankIcon,
  BanknoteIcon,
  CashAppIcon,
  CreditCardIcon,
  ZelleIcon,
  type Icon,
  type IconProps,
} from "@/components/ui/icons"
import type { PaymentMethodSnapshot } from "@/lib/payment-rules"

const ICONS: Record<PaymentMethodSnapshot["type"], Icon> = {
  bank_transfer: BankIcon,
  zelle: ZelleIcon,
  cash_app: CashAppIcon,
  other: BanknoteIcon,
  card: CreditCardIcon,
}

// The icon of a way to pay (lib/payment-rules.ts): a bank for a transfer,
// Zelle's and Cash App's own logos, a card for paying online, a banknote
// for the rest. One place, for the owner's settings, the booking flow, the
// customer's booking and the admin. Decorative: the way's name is always
// beside it.
export function PaymentTypeIcon({
  type,
  ...props
}: IconProps & { type: PaymentMethodSnapshot["type"] }) {
  const TypeIcon = ICONS[type]
  return <TypeIcon {...props} />
}
