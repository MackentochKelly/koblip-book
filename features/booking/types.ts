export interface AvailabilityDay { date: string; times: string[] } // date "YYYY-MM-DD", times "HH:mm", business time zone
export interface Availability { days: AvailabilityDay[] }
export interface BookingInput { slug: string; serviceId: string; teamMemberId: string | null; addonIds: string[]; date: string; time: string; name: string; phone: string }
export interface BookingConfirmation {
  id: string; businessName: string; address: string | null; timeZone: string
  serviceName: string; teamMemberName: string | null; durationMinutes: number; priceMinor: number | null; currency: string
  date: string; time: string
  addons: { name: string; priceMinor: number | null; durationMinutes: number }[]
}
export type BookingResult =
  | { status: "booked"; booking: BookingConfirmation }
  | { status: "taken" }
  | { status: "invalid"; field: "service" | "teamMember" | "addons" | "time" | "name" | "phone" }
  | { status: "failed" }
