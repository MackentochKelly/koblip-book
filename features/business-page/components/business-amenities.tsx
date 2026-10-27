import {
  AccessibilityIcon,
  BabyIcon,
  BanknoteIcon,
  CarFrontIcon,
  CreditCardIcon,
  NfcIcon,
  PawPrintIcon,
  ToiletIcon,
  type LucideIcon,
} from "lucide-react"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import type { Amenity } from "../types"

const ICONS: Record<Amenity, LucideIcon> = {
  wheelchair: AccessibilityIcon,
  parking: CarFrontIcon,
  pets: PawPrintIcon,
  kids: BabyIcon,
  restroom: ToiletIcon,
  cards: CreditCardIcon,
  nfc: NfcIcon,
  cash_only: BanknoteIcon,
}

// What Google says is true of the place (wheelchair access, parking…).
export function BusinessAmenities({
  amenities,
  language,
}: {
  amenities: Amenity[]
  language: PageLanguage
}) {
  const labels = messagesFor(language).amenities
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {amenities.map((amenity) => {
        const Icon = ICONS[amenity]
        return (
          <li
            key={amenity}
            className="flex items-center gap-3 [&_svg]:size-5 [&_svg]:shrink-0"
          >
            <Icon aria-hidden="true" />
            {labels[amenity]}
          </li>
        )
      })}
    </ul>
  )
}
