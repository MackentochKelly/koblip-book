// Google's directions to a business, from wherever the visitor is (the
// business page and the "You're booked" page).
// The coordinates are the live Google value on the page business, never
// stored; without them it falls back to the address.
export function directionsUrl(business: {
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
}): string | null {
  if (business.latitude !== null && business.longitude !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`
  }
  if (business.address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${business.name}, ${business.address}`)}`
  }
  return null
}
