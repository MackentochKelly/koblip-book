import type { PageLanguage } from "@/lib/page-language"
import type {
  businessHours,
  businessPhotos,
  businesses,
  services,
  teamMembers,
} from "@/lib/db/schema"

export type Business = typeof businesses.$inferSelect
export type BusinessHour = typeof businessHours.$inferSelect
export type Service = typeof services.$inferSelect
export type TeamMember = typeof teamMembers.$inferSelect
export type BusinessPhoto = typeof businessPhotos.$inferSelect

export interface PagePhoto {
  id: string
  url: string
  credit: { name: string; uri: string | null } | null
}

export interface PageReview {
  author: { name: string; uri: string | null; photoUrl: string | null }
  rating: number
  when: string
  text: string
}

export type Amenity =
  | "wheelchair"
  | "parking"
  | "pets"
  | "kids"
  | "restroom"
  | "cards"
  | "nfc"
  | "cash_only"

export interface BusinessPageData {
  business: Business
  hours: BusinessHour[]
  services: Service[]
  team: TeamMember[]
  photos: PagePhoto[]
  reviews: PageReview[]
  amenities: Amenity[]
  language: PageLanguage
  // serviceId → teamMemberIds that do it, from team_member_services; a
  // service missing from the record is done by everyone.
  serviceTeams: Record<string, string[]>
  addonGroups: { id: string; prompt: string; minSelect: number; maxSelect: number | null; serviceIds: string[]; options: { id: string; name: string; description: string | null; priceMinor: number | null; durationMinutes: number }[] }[]
}
