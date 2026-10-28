export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }
export interface OwnedBusiness { id: string; slug: string; name: string; address: string | null }
export type BookingStatus = "confirmed" | "cancelled" | "completed" | "no_show"
export interface OwnerBooking {
  id: string; date: string; time: string; endTime: string // business time zone
  startAt: string; endAt: string; serviceId: string | null; serviceName: string; teamMemberId: string | null; teamMemberName: string | null
  durationMinutes: number; priceMinor: number | null; currency: string
  customerName: string; customerPhone: string | null; customerKey: string
  status: BookingStatus; source: "online" | "owner"; note: string | null
  addons: { name: string; priceMinor: number | null; durationMinutes: number }[]
}
export interface AddonOptionInput { id: string | null; name: string; description: string | null; priceMinor: number | null; durationMinutes: number } // id null = new
export interface AddonGroupInput { name: string; prompt: string; minSelect: number; maxSelect: number | null; serviceIds: string[]; options: AddonOptionInput[] } // options in display order
export interface OwnerAddonOption { id: string; name: string; description: string | null; priceMinor: number | null; durationMinutes: number }
export interface OwnerAddonGroup { id: string; name: string; prompt: string; minSelect: number; maxSelect: number | null; serviceIds: string[]; options: OwnerAddonOption[] }
export interface OwnerCustomer {
  key: string
  name: string // from their latest booking
  phone: string | null
  bookings: number // all statuses
  completed: number
  noShows: number
  cancelled: number
  lastVisit: string | null // "YYYY-MM-DD" of the latest completed booking, business time zone
  firstBooking: string | null // "YYYY-MM-DD" of the earliest booking of any status, business time zone
  nextBooking: string | null // "YYYY-MM-DD" of the next confirmed booking that has not started
  spentMinor: number // sum of priceMinor of completed bookings
  currency: string
}
export interface HoursRow { weekday: number; opensAt: string; closesAt: string }
export interface ServiceInput { name: string; description: string | null; durationMinutes: number; priceMinor: number | null }
export interface ServiceSuggestion { name: string; description: string | null; durationMinutes: number }
export interface AddonOptionSuggestion { name: string; description: string | null; durationMinutes: number }
export interface AddonGroupSuggestion { name: string; prompt: string; minSelect: number; maxSelect: number | null; serviceIds: string[]; options: AddonOptionSuggestion[] }
export interface BusinessDetailsInput { name: string; address: string | null; description: string | null; phone: string | null; website: string | null; seats: number }
