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
import type { Amenity } from "../types"

const AMENITIES: Record<Amenity, { icon: LucideIcon; label: string }> = {
  wheelchair: { icon: AccessibilityIcon, label: "Wheelchair accessible" },
  parking: { icon: CarFrontIcon, label: "Parking available" },
  pets: { icon: PawPrintIcon, label: "Pet-friendly" },
  kids: { icon: BabyIcon, label: "Kid-friendly" },
  restroom: { icon: ToiletIcon, label: "Restroom" },
  cards: { icon: CreditCardIcon, label: "Accepts cards" },
  nfc: { icon: NfcIcon, label: "Mobile payments" },
  cash_only: { icon: BanknoteIcon, label: "Cash only" },
}

// What Google says is true of the place (wheelchair access, parking…).
export function BusinessAmenities({ amenities }: { amenities: Amenity[] }) {
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {amenities.map((amenity) => {
        const { icon: Icon, label } = AMENITIES[amenity]
        return (
          <li
            key={amenity}
            className="flex items-center gap-3 [&_svg]:size-5 [&_svg]:shrink-0"
          >
            <Icon aria-hidden="true" />
            {label}
          </li>
        )
      })}
    </ul>
  )
}
