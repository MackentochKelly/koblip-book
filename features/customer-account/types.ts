// One booking on the customer's own page.
export interface MyBooking {
  id: string
  // Day and time in the business's time zone, in the page's language.
  when: string
  cancelled: boolean
  // Confirmed and still ahead: it can still be moved or called off.
  ahead: boolean
  // What the customer wrote when booking.
  note: string | null
  // Still ahead and confirmed: what "Can't make it" does at this business
  // (cancels, or tells the owner), and whether they already said it.
  cantCome: "cancel" | "alertOnly" | null
  saidCantCome: boolean
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
