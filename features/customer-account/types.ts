// One booking on the customer's own page.
export interface MyBooking {
  id: string
  // Day and time in the business's time zone, in the page's language.
  when: string
  cancelled: boolean
  serviceName: string
  addons: string[]
  teamMemberName: string | null
  durationMinutes: number
  priceMinor: number | null
  currency: string
  business: {
    slug: string
    name: string
    photoUrl: string | null
    address: string | null
  }
}
