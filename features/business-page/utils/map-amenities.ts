import type { Amenity } from "../types"

export interface GoogleAmenityFlags {
  accessibilityOptions?: Record<string, boolean | undefined> | null
  parkingOptions?: Record<string, boolean | undefined> | null
  paymentOptions?: {
    acceptsCreditCards?: boolean
    acceptsDebitCards?: boolean
    acceptsCashOnly?: boolean
    acceptsNfc?: boolean
  } | null
  allowsDogs?: boolean
  goodForChildren?: boolean
  restroom?: boolean
}

function anyTrue(
  options: Record<string, boolean | undefined> | null | undefined
): boolean {
  return (
    options != null && Object.values(options).some((value) => value === true)
  )
}

// Google booleans → amenities, in display order. Only `=== true` counts;
// cash-only wins over cards and NFC.
export function mapAmenities(flags: GoogleAmenityFlags): Amenity[] {
  const amenities: Amenity[] = []
  if (anyTrue(flags.accessibilityOptions)) {
    amenities.push("wheelchair")
  }
  if (anyTrue(flags.parkingOptions)) {
    amenities.push("parking")
  }
  if (flags.allowsDogs === true) {
    amenities.push("pets")
  }
  if (flags.goodForChildren === true) {
    amenities.push("kids")
  }
  if (flags.restroom === true) {
    amenities.push("restroom")
  }
  const cashOnly = flags.paymentOptions?.acceptsCashOnly === true
  if (
    !cashOnly &&
    (flags.paymentOptions?.acceptsCreditCards === true ||
      flags.paymentOptions?.acceptsDebitCards === true)
  ) {
    amenities.push("cards")
  }
  if (!cashOnly && flags.paymentOptions?.acceptsNfc === true) {
    amenities.push("nfc")
  }
  if (cashOnly) {
    amenities.push("cash_only")
  }
  return amenities
}
