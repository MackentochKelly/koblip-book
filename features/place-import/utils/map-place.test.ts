import { expect, test } from "vitest"
import type { GooglePlace } from "../api/fetch-place"
import { mapPlace, slugify, uniqueSlug } from "./map-place"

function place(overrides: Partial<GooglePlace> = {}): GooglePlace {
  return {
    id: "places/ChIJ123",
    displayName: { text: "Barbarock Barbershop" },
    formattedAddress: "Av. Churchill, Santo Domingo",
    internationalPhoneNumber: "+18095550134",
    websiteUri: "https://example.com",
    primaryTypeDisplayName: { text: "Barber shop" },
    regularOpeningHours: {
      periods: [
        {
          open: { day: 1, hour: 9, minute: 0 },
          close: { day: 1, hour: 18, minute: 30 },
        },
      ],
    },
    timeZone: { id: "America/Santo_Domingo" },
    businessStatus: "OPERATIONAL",
    addressComponents: [
      { types: ["country"], shortText: "DO" },
      { types: ["locality"], shortText: "Santo Domingo" },
    ],
    ...overrides,
  }
}

test("maps every field to the businesses row and hours rows", () => {
  const { business, hours } = mapPlace(place())

  expect(business).toMatchObject({
    googlePlaceId: "places/ChIJ123",
    name: "Barbarock Barbershop",
    address: "Av. Churchill, Santo Domingo",
    phone: "+18095550134",
    website: "https://example.com",
    category: "Barber shop",
    timezone: "America/Santo_Domingo",
    status: "operational",
    currency: "DOP",
  })
  expect(hours).toEqual([{ weekday: 1, opensAt: "09:00", closesAt: "18:30" }])
})

test("never keeps Google cached content", () => {
  const { business } = mapPlace(place())
  for (const field of [
    "rating",
    "reviewCount",
    "mapsUrl",
    "latitude",
    "longitude",
    "description",
  ] as const) {
    expect(business).not.toHaveProperty(field)
  }
  expect(business.googlePlaceId).toBe("places/ChIJ123")
})

test("maps each business status", () => {
  expect(
    mapPlace(place({ businessStatus: "OPERATIONAL" })).business.status
  ).toBe("operational")
  expect(
    mapPlace(place({ businessStatus: "CLOSED_TEMPORARILY" })).business.status
  ).toBe("temporarily_closed")
  expect(
    mapPlace(place({ businessStatus: "CLOSED_PERMANENTLY" })).business.status
  ).toBe("closed")
  expect(
    mapPlace(place({ businessStatus: "UNKNOWN" })).business.status
  ).toBeNull()
  expect(
    mapPlace(place({ businessStatus: undefined })).business.status
  ).toBeNull()
})

test("derives currency from the address country, defaulting to USD", () => {
  const withCountry = (code: string | undefined) =>
    mapPlace(
      place({
        addressComponents:
          code === undefined ? [] : [{ types: ["country"], shortText: code }],
      })
    ).business.currency

  expect(withCountry("DO")).toBe("DOP")
  expect(withCountry("US")).toBe("USD")
  expect(withCountry("ES")).toBe("EUR")
  expect(withCountry("GB")).toBe("GBP")
  expect(withCountry("XX")).toBe("USD")
  expect(withCountry(undefined)).toBe("USD")
})

test("keeps an overnight period on its opening weekday", () => {
  const { hours } = mapPlace(
    place({
      regularOpeningHours: {
        periods: [
          {
            open: { day: 5, hour: 20, minute: 0 },
            close: { day: 6, hour: 2, minute: 0 },
          },
        ],
      },
    })
  )
  expect(hours).toEqual([{ weekday: 5, opensAt: "20:00", closesAt: "02:00" }])
})

test("maps a 24-hour place to midnight–midnight", () => {
  const { hours } = mapPlace(
    place({
      regularOpeningHours: {
        periods: [{ open: { day: 0, hour: 0, minute: 0 } }],
      },
    })
  )
  expect(hours).toEqual([{ weekday: 0, opensAt: "00:00", closesAt: "00:00" }])
})

test("builds slugs and appends -2, -3 when taken", () => {
  expect(slugify("Barbarock Barbershop Churchill")).toBe(
    "barbarock-barbershop-churchill"
  )
  expect(slugify("Peliquería ¡Hola!")).toBe("peliqueria-hola")

  const taken = new Set(["shop", "shop-2"])
  expect(uniqueSlug("barbershop", () => false)).toBe("barbershop")
  expect(uniqueSlug("shop", (slug) => taken.has(slug))).toBe("shop-3")
})
