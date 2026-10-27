// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { businesses } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "test-key")

let getBusinessPage: typeof import("./get-business-page").getBusinessPage
let closeDb: () => void
let dir: string
let seenFieldMask = ""

const detailsPayload = {
  photos: [
    {
      name: "places/ChIJ1/photos/photoA",
      authorAttributions: [
        { displayName: "A Photographer", uri: "https://example.com/a" },
      ],
    },
  ],
  reviews: [
    {
      rating: 5,
      relativePublishTimeDescription: "2 weeks ago",
      text: { text: "Best cut in town", languageCode: "en" },
      authorAttribution: {
        displayName: "Jane Reviewer",
        uri: "https://example.com/jane",
        photoUri: "https://lh3.googleusercontent.com/jane-photo",
      },
    },
    {
      // No text: skipped.
      rating: 4,
      relativePublishTimeDescription: "a month ago",
      authorAttribution: { displayName: "Silent Sam" },
    },
  ],
  accessibilityOptions: { wheelchairAccessibleEntrance: true },
  parkingOptions: { freeParkingLot: false },
  paymentOptions: { acceptsCreditCards: true, acceptsNfc: true },
  allowsDogs: true,
  goodForChildren: false,
  restroom: true,
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-google-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`

  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()

  await db.insert(businesses).values([
    {
      id: "biz-google",
      slug: "google-shop",
      name: "Google Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      googlePlaceId: "ChIJ1",
    },
    {
      id: "biz-google-failing",
      slug: "google-shop-failing",
      name: "Failing Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      googlePlaceId: "ChIJ-fail",
    },
  ])

  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    seenFieldMask = (init?.headers as Record<string, string>)[
      "X-Goog-FieldMask"
    ]
    if (String(url).includes("ChIJ-fail")) {
      return new Response("bad", { status: 500 })
    }
    expect(String(url)).toContain("/v1/places/ChIJ1")
    return new Response(JSON.stringify(detailsPayload), { status: 200 })
  }) as typeof fetch

  ;({ getBusinessPage } = await import("./get-business-page"))
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("asks for photos, reviews and amenities in one field mask", async () => {
  await getBusinessPage("google-shop")
  expect(seenFieldMask).toBe(
    "photos,reviews,accessibilityOptions,parkingOptions,paymentOptions,allowsDogs,goodForChildren,restroom"
  )
})

test("maps reviews and skips the one with no text", async () => {
  const data = await getBusinessPage("google-shop")
  expect(data?.reviews).toEqual([
    {
      author: {
        name: "Jane Reviewer",
        uri: "https://example.com/jane",
        photoUrl: "https://lh3.googleusercontent.com/jane-photo",
      },
      rating: 5,
      when: "2 weeks ago",
      text: "Best cut in town",
    },
  ])
})

test("maps Google photos and amenities on the same page", async () => {
  const data = await getBusinessPage("google-shop")
  expect(data?.photos).toEqual([
    {
      id: "places/ChIJ1/photos/photoA",
      url: "/api/place-photo?name=places%2FChIJ1%2Fphotos%2FphotoA",
      credit: { name: "A Photographer", uri: "https://example.com/a" },
    },
  ])
  expect(data?.amenities).toEqual([
    "wheelchair",
    "pets",
    "restroom",
    "cards",
    "nfc",
  ])
})

test("returns no extras when Google fails, and the page still loads", async () => {
  const data = await getBusinessPage("google-shop-failing")
  expect(data?.business.name).toBe("Failing Shop")
  expect(data?.reviews).toEqual([])
  expect(data?.amenities).toEqual([])
  expect(data?.photos).toEqual([])
})
