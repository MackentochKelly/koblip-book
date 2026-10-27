import type { Business } from "../types"

// Google's directions to the business, from wherever the visitor is.
export function directionsUrl(business: Business): string | null {
  if (!business.address) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${business.name}, ${business.address}`)}`
}
