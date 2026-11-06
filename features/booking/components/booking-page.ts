import type {
  serviceCategories,
  services,
  teamMembers,
} from "@/lib/db/schema"
import { directionsUrl } from "@/lib/directions-url"
import type { PolicyKind, PolicyPointIcon } from "@/lib/policy-rules"
import { checkAddons } from "../utils/addons"

type ServiceRow = typeof services.$inferSelect
type TeamMemberRow = typeof teamMembers.$inferSelect

export type BookingService = Pick<
  ServiceRow,
  "id" | "name" | "durationMinutes" | "priceMinor" | "categoryId"
>
// A group of services (Hair, Nails…), named in the page's language.
export type BookingServiceCategory = Pick<
  typeof serviceCategories.$inferSelect,
  "id" | "name"
>
export type BookingMember = Pick<
  TeamMemberRow,
  "id" | "name" | "photoUrl" | "description"
>

export interface BookingAddonOption {
  id: string
  name: string
  description: string | null
  priceMinor: number | null
  durationMinutes: number
}

export interface BookingAddonGroup {
  id: string
  prompt: string
  minSelect: number
  maxSelect: number | null
  serviceIds: string[]
  options: BookingAddonOption[]
}

// What the booking screens need from the business page.
export interface BookingPage {
  slug: string
  name: string
  // The first photo, for the "You're booked" page.
  photoUrl: string | null
  address: string | null
  // Google's directions there, or null without an address or a place.
  directionsUrl: string | null
  phone: string | null
  timeZone: string
  currency: string
  services: BookingService[]
  // In the owner's order; a service's categoryId points to one, null for
  // Other (docs/plans/service-categories.md).
  serviceCategories: BookingServiceCategory[]
  team: BookingMember[]
  // serviceId → the members who do it; missing = everyone.
  serviceTeams: Record<string, string[]>
  addonGroups: BookingAddonGroup[]
  // Whether the business sends WhatsApp booking messages (consent asked).
  whatsapp: boolean
  // Whether My bookings is open (it needs phone codes, lib/phone-sign-in.ts):
  // "Manage your booking" after booking.
  manageBookings: boolean
  policies: BookingPolicies
}

export interface BookingPolicyPoint {
  id: string
  icon: PolicyPointIcon
  title: string
  body: string
}

// What the customer agrees to in the last step: the key points as cards,
// and the policies they link to. Both empty: no such step.
export interface BookingPolicies {
  documents: PolicyKind[]
  points: BookingPolicyPoint[]
}

export function hasBookingPolicies(policies: BookingPolicies): boolean {
  return policies.documents.length > 0 || policies.points.length > 0
}

export interface BookingSlot {
  date: string
  time: string
}

// Who can do a service: its own list, or the whole team.
export function serviceTeam(
  page: BookingPage,
  serviceId: string | null
): BookingMember[] {
  const allowed = serviceId ? page.serviceTeams[serviceId] : undefined
  return allowed
    ? page.team.filter((member) => allowed.includes(member.id))
    : page.team
}

// The extras a service offers, in page order.
export function serviceAddonGroups(
  page: BookingPage,
  serviceId: string | null
): BookingAddonGroup[] {
  if (!serviceId) return []
  return page.addonGroups.filter((group) => group.serviceIds.includes(serviceId))
}

// The service with the chosen extras: whether the choice is complete, the
// chosen options, and the total length and price (null = no price shown).
export function bookingTotals(
  service: BookingService,
  groups: BookingAddonGroup[],
  addonIds: string[]
) {
  const checked = checkAddons(groups, addonIds)
  const extras = checked.ok ? checked.options : []
  const extraPrice = checked.ok ? checked.extraPriceMinor : null
  return {
    valid: checked.ok,
    extras,
    durationMinutes:
      service.durationMinutes + (checked.ok ? checked.extraMinutes : 0),
    priceMinor:
      service.priceMinor === null && extraPrice === null
        ? null
        : (service.priceMinor ?? 0) + (extraPrice ?? 0),
  }
}

// The page's rows down to what the booking screens use.
export function toBookingPage(data: {
  business: {
    slug: string
    name: string
    address: string | null
    latitude: number | null
    longitude: number | null
    phone: string | null
    timezone: string
    currency: string
  }
  photos: { url: string }[]
  services: ServiceRow[]
  serviceCategories: BookingServiceCategory[]
  team: BookingMember[]
  serviceTeams: Record<string, string[]>
  addonGroups: BookingAddonGroup[]
  whatsapp: boolean
  manageBookings: boolean
  policies: PolicyKind[]
  policyPoints: BookingPolicyPoint[]
}): BookingPage {
  return {
    slug: data.business.slug,
    name: data.business.name,
    photoUrl: data.photos[0]?.url ?? null,
    address: data.business.address,
    directionsUrl: directionsUrl(data.business),
    phone: data.business.phone,
    timeZone: data.business.timezone,
    currency: data.business.currency,
    services: data.services.map(
      ({ id, name, durationMinutes, priceMinor, categoryId }) => ({
        id,
        name,
        durationMinutes,
        priceMinor,
        categoryId,
      })
    ),
    serviceCategories: data.serviceCategories.map(({ id, name }) => ({
      id,
      name,
    })),
    team: data.team.map(({ id, name, photoUrl, description }) => ({
      id,
      name,
      photoUrl,
      description,
    })),
    serviceTeams: data.serviceTeams,
    addonGroups: data.addonGroups,
    whatsapp: data.whatsapp,
    manageBookings: data.manageBookings,
    policies: { documents: data.policies, points: data.policyPoints },
  }
}
