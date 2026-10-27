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

export interface BusinessPageData {
  business: Business
  hours: BusinessHour[]
  services: Service[]
  team: TeamMember[]
  photos: PagePhoto[]
}
