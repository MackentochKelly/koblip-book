import {
  BankIcon,
  BanknoteIcon,
  CashAppIcon,
  ZelleIcon,
  type Icon,
  type IconProps,
} from "@/components/ui/icons"
import type { PaymentType } from "@/lib/payment-rules"

const ICONS: Record<PaymentType, Icon> = {
  bank_transfer: BankIcon,
  zelle: ZelleIcon,
  cash_app: CashAppIcon,
  other: BanknoteIcon,
}

// The icon of a way to pay outside the app (lib/payment-rules.ts): a bank
// for a transfer, Zelle's and Cash App's own logos, a banknote for the
// rest. One place, for the owner's settings, the booking flow, the
// customer's booking and the admin. Decorative: the way's name is always
// beside it.
export function PaymentTypeIcon({
  type,
  ...props
}: IconProps & { type: PaymentType }) {
  const TypeIcon = ICONS[type]
  return <TypeIcon {...props} />
}
