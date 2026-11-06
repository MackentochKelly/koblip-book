import "server-only"
import { cache } from "react"
import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  addonGroups,
  addonOptions,
  businessHours,
  businessPhotos,
  businessPolicies,
  businessPolicyPoints,
  businesses,
  serviceAddonGroups,
  serviceCategories,
  services,
  teamMemberServices,
  teamMembers,
} from "@/lib/db/schema"
import { DEFAULT_LANGUAGE, type PageLanguage } from "@/lib/page-language"
import { placePhotoUrl } from "@/lib/place-photo"
import { orderPolicies, type PolicyLink } from "@/lib/policy-rules"
import { getBusinessTranslations } from "@/lib/translations/business-texts"
import type { Amenity, BusinessPageData, PagePhoto, PageReview } from "../types"
import { mapAmenities } from "../utils/map-amenities"

interface GooglePhotoAttribution {
  displayName?: string
  uri?: string
}

interface GooglePhoto {
  name?: string
  authorAttributions?: GooglePhotoAttribution[]
}

interface GoogleReview {
  rating?: number
  relativePublishTimeDescription?: string
  text?: { text?: string; languageCode?: string }
  authorAttribution?: {
    displayName?: string
    uri?: string
    photoUri?: string
  }
}

interface GoogleDetails {
  photos?: GooglePhoto[]
  reviews?: GoogleReview[]
  rating?: number
  userRatingCount?: number
  googleMapsUri?: string
  location?: { latitude?: number; longitude?: number }
  accessibilityOptions?: Record<string, boolean | undefined>
  parkingOptions?: Record<string, boolean | undefined>
  paymentOptions?: {
    acceptsCreditCards?: boolean
    acceptsDebitCards?: boolean
    acceptsCashOnly?: boolean
    acceptsNfc?: boolean
  }
  allowsDogs?: boolean
  goodForChildren?: boolean
  restroom?: boolean
}

interface GoogleExtras {
  photos: PagePhoto[]
  reviews: PageReview[]
  amenities: Amenity[]
  // Live from Google on every view, never stored (Places policies forbid
  // caching them; only the place ID may be kept). Null when Google fails.
  rating: number | null
  reviewCount: number | null
  mapsUrl: string | null
  latitude: number | null
  longitude: number | null
}

const EMPTY_EXTRAS: GoogleExtras = {
  photos: [],
  reviews: [],
  amenities: [],
  rating: null,
  reviewCount: null,
  mapsUrl: null,
  latitude: null,
  longitude: null,
}

const DETAILS_FIELD_MASK =
  "photos,reviews,rating,userRatingCount,googleMapsUri,location,accessibilityOptions,parkingOptions,paymentOptions,allowsDogs,goodForChildren,restroom"

// Fresh from Google on each page view, never stored: rating, review count,
// Maps URL, coordinates, reviews, amenities and photo names may not be
// cached, so they always come from one new Details call. Google failures
// return no extras; the page still loads.
async function getGoogleExtras(
  googlePlaceId: string | null,
  language: PageLanguage
): Promise<GoogleExtras> {
  if (!googlePlaceId) {
    return EMPTY_EXTRAS
  }
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY
  if (!key) {
    return EMPTY_EXTRAS
  }
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${googlePlaceId}?languageCode=${language}`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": DETAILS_FIELD_MASK,
        },
        cache: "no-store",
      }
    )
    if (!res.ok) {
      return EMPTY_EXTRAS
    }
    const data = (await res.json()) as GoogleDetails
    const googlePhotos = Array.isArray(data.photos)
      ? data.photos.slice(0, 10)
      : []
    const photos: PagePhoto[] = googlePhotos
      .filter((photo) => typeof photo.name === "string" && photo.name)
      .map((photo) => {
        const credit = photo.authorAttributions?.[0]
        return {
          id: photo.name as string,
          url: placePhotoUrl(photo.name as string),
          credit: credit?.displayName
            ? { name: credit.displayName, uri: credit.uri ?? null }
            : null,
        }
      })
    // Reviews without text are skipped. An author's photo URL is returned
    // as is, never proxied.
    const reviews: PageReview[] = (
      Array.isArray(data.reviews) ? data.reviews : []
    )
      .filter((review) => review.text?.text)
      .map((review) => ({
        author: {
          name: review.authorAttribution?.displayName ?? "",
          uri: review.authorAttribution?.uri ?? null,
          photoUrl: review.authorAttribution?.photoUri ?? null,
        },
        rating: review.rating ?? 0,
        when: review.relativePublishTimeDescription ?? "",
        text: review.text?.text as string,
      }))
    const amenities = mapAmenities({
      accessibilityOptions: data.accessibilityOptions,
      parkingOptions: data.parkingOptions,
      paymentOptions: data.paymentOptions,
      allowsDogs: data.allowsDogs,
      goodForChildren: data.goodForChildren,
      restroom: data.restroom,
    })
    return {
      photos,
      reviews,
      amenities,
      rating: typeof data.rating === "number" ? data.rating : null,
      reviewCount:
        typeof data.userRatingCount === "number" ? data.userRatingCount : null,
      mapsUrl:
        typeof data.googleMapsUri === "string" ? data.googleMapsUri : null,
      latitude:
        typeof data.location?.latitude === "number"
          ? data.location.latitude
          : null,
      longitude:
        typeof data.location?.longitude === "number"
          ? data.location.longitude
          : null,
    }
  } catch {
    return EMPTY_EXTRAS
  }
}

async function loadBusinessPage(
  slug: string,
  language: PageLanguage = DEFAULT_LANGUAGE
): Promise<BusinessPageData | null> {
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1)
  if (!business) {
    return null
  }

  const [
    hours,
    serviceRows,
    categoryRows,
    team,
    ownPhotos,
    teamLinks,
    translated,
    addonGroupRows,
    addonOptionRows,
    addonLinkRows,
    policyRows,
    pointRows,
  ] = await Promise.all([
      db
        .select()
        .from(businessHours)
        .where(eq(businessHours.businessId, business.id))
        .orderBy(asc(businessHours.weekday), asc(businessHours.opensAt)),
      db
        .select()
        .from(services)
        .where(eq(services.businessId, business.id))
        .orderBy(asc(services.position)),
      db
        .select({ id: serviceCategories.id, name: serviceCategories.name })
        .from(serviceCategories)
        .where(eq(serviceCategories.businessId, business.id))
        .orderBy(asc(serviceCategories.position)),
      db
        .select({
          id: teamMembers.id,
          name: teamMembers.name,
          photoUrl: teamMembers.photoUrl,
          description: teamMembers.description,
        })
        .from(teamMembers)
        .where(eq(teamMembers.businessId, business.id))
        .orderBy(asc(teamMembers.position)),
      db
        .select()
        .from(businessPhotos)
        .where(eq(businessPhotos.businessId, business.id))
        .orderBy(asc(businessPhotos.position)),
      db
        .select({
          serviceId: teamMemberServices.serviceId,
          teamMemberId: teamMemberServices.teamMemberId,
        })
        .from(teamMemberServices)
        .where(eq(teamMemberServices.businessId, business.id)),
      getBusinessTranslations(business.id, language),
      db
        .select()
        .from(addonGroups)
        .where(eq(addonGroups.businessId, business.id))
        .orderBy(asc(addonGroups.position)),
      db
        .select()
        .from(addonOptions)
        .where(eq(addonOptions.businessId, business.id))
        .orderBy(asc(addonOptions.position)),
      db
        .select()
        .from(serviceAddonGroups)
        .where(eq(serviceAddonGroups.businessId, business.id)),
      db
        .select({
          id: businessPolicies.id,
          kind: businessPolicies.kind,
          title: businessPolicies.title,
          createdAt: businessPolicies.createdAt,
        })
        .from(businessPolicies)
        .where(eq(businessPolicies.businessId, business.id)),
      db
        .select({
          id: businessPolicyPoints.id,
          icon: businessPolicyPoints.icon,
          title: businessPolicyPoints.title,
          body: businessPolicyPoints.body,
        })
        .from(businessPolicyPoints)
        .where(eq(businessPolicyPoints.businessId, business.id))
        .orderBy(asc(businessPolicyPoints.position)),
    ])

  const extras = await getGoogleExtras(business.googlePlaceId, language)

  // The business's own photos win over Google's.
  const photos: PagePhoto[] =
    ownPhotos.length > 0
      ? ownPhotos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          credit: null,
        }))
      : extras.photos

  const serviceTeams: Record<string, string[]> = {}
  for (const link of teamLinks) {
    ;(serviceTeams[link.serviceId] ??= []).push(link.teamMemberId)
  }

  // In another language: each text's translation where there is one made
  // from the current English (lib/translations/business-texts), else the
  // English.
  const pageBusiness = {
    ...business,
    description:
      business.description &&
      translated(business.id, "business.description", business.description),
    category:
      business.category &&
      translated(business.id, "business.category", business.category),
  }
  const pageServices = serviceRows.map((service) => ({
    ...service,
    name: translated(service.id, "service.name", service.name),
    description:
      service.description &&
      translated(service.id, "service.description", service.description),
  }))
  const pageCategories = categoryRows.map((category) => ({
    ...category,
    name: translated(category.id, "service_category.name", category.name),
  }))
  const pageTeam = team.map((member) => ({
    ...member,
    description:
      member.description &&
      translated(member.id, "team_member.description", member.description),
  }))
  // The owner's own policies' titles; a standard one's name is the page's.
  const pagePolicies: PolicyLink[] = orderPolicies(policyRows).map(
    ({ id, kind, title }) => ({
      id,
      kind,
      title: title && translated(id, "policy.title", title),
    })
  )
  const pagePoints = pointRows.map((point) => ({
    ...point,
    title: translated(point.id, "policy_point.title", point.title),
    body: translated(point.id, "policy_point.body", point.body),
  }))

  // Add-on groups show only when linked to at least one service and
  // holding at least one option.
  const serviceOrder = new Map(
    serviceRows.map((service, index) => [service.id, index] as const)
  )
  const pageAddonGroups = addonGroupRows.flatMap((group) => {
    const options = addonOptionRows
      .filter((option) => option.groupId === group.id)
      .map((option) => ({
        id: option.id,
        name: translated(option.id, "addon.name", option.name),
        description:
          option.description &&
          translated(option.id, "addon.description", option.description),
        priceMinor: option.priceMinor,
        durationMinutes: option.durationMinutes,
      }))
    const serviceIds = addonLinkRows
      .filter((link) => link.groupId === group.id)
      .map((link) => link.serviceId)
      .sort((a, b) => (serviceOrder.get(a) ?? 0) - (serviceOrder.get(b) ?? 0))
    if (serviceIds.length === 0 || options.length === 0) {
      return []
    }
    return [
      {
        id: group.id,
        prompt: translated(group.id, "addon_group.prompt", group.prompt),
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        serviceIds,
        options,
      },
    ]
  })

  // The five Google extras ride on the page business so every .tsx stays
  // as it is; they are live values, never read from the database.
  const liveBusiness = {
    ...pageBusiness,
    rating: extras.rating,
    reviewCount: extras.reviewCount,
    mapsUrl: extras.mapsUrl,
    latitude: extras.latitude,
    longitude: extras.longitude,
  }

  return {
    business: liveBusiness,
    hours,
    services: pageServices,
    serviceCategories: pageCategories,
    team: pageTeam,
    photos,
    reviews: extras.reviews,
    amenities: extras.amenities,
    language,
    serviceTeams,
    addonGroups: pageAddonGroups,
    // In lib/policy-rules' one order, so the footer links never move.
    policies: pagePolicies,
    policyPoints: pagePoints,
  }
}

export const getBusinessPage = cache(loadBusinessPage)
