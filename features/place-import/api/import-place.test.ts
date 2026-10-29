// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { businessHours, businesses, user } from "@/lib/db/schema"
import type { GooglePlace } from "./fetch-place"

vi.mock("server-only", () => ({}))

// Google and Meta AI never run here: each test says what the place is, and
// About writing waits for `release`, so two imports can be made to ask at
// the same moment, before either saves.
const places = new Map<string, GooglePlace>()
let release: () => void = () => {}
let gate = Promise.resolve()
const fetchPlace = vi.fn(async (placeId: string) => places.get(placeId))
const writeAbout = vi.fn(async () => {
  await gate
  return "About text"
})
vi.mock("./fetch-place", () => ({
  fetchPlace: (placeId: string) => fetchPlace(placeId),
}))
vi.mock("./write-about", () => ({
  writeAbout: () => writeAbout(),
}))
// A pasted link or text always points at place p1 here.
vi.mock("./find-place-id", () => ({
  findPlaceId: async () => "p1",
}))

const { importPlace, importPlaceById } = await import("./import-place")

let dir: string
let closeDb: () => void

function place(id: string, name: string): GooglePlace {
  return {
    id,
    displayName: { text: name },
    primaryTypeDisplayName: { text: "Barber shop" },
    regularOpeningHours: {
      periods: [
        {
          open: { day: 1, hour: 9, minute: 0 },
          close: { day: 1, hour: 18, minute: 0 },
        },
      ],
    },
    timeZone: { id: "America/Santo_Domingo" },
    businessStatus: "OPERATIONAL",
    addressComponents: [{ types: ["country"], shortText: "DO" }],
  }
}

// Both imports wait at About writing until both have started.
function holdAbout() {
  gate = new Promise((resolve) => {
    release = resolve
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-import-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values({
    id: "u1",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: true,
  })
})

beforeEach(async () => {
  const { db } = await import("@/lib/db")
  await db.delete(businessHours)
  await db.delete(businesses)
  places.clear()
  gate = Promise.resolve()
  fetchPlace.mockClear()
  writeAbout.mockClear()
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("a name with no Latin letters gets the business type as its slug", async () => {
  places.set("p1", place("p1", "東京理容"))
  places.set("p2", place("p2", "Салон"))

  expect(await importPlaceById("p1")).toBe("barber-shop")
  expect(await importPlaceById("p2")).toBe("barber-shop-2")
})

test("two places with the same name imported at once get different slugs", async () => {
  places.set("p1", place("p1", "Barbarock"))
  places.set("p2", place("p2", "Barbarock"))
  holdAbout()

  const both = Promise.all([importPlaceById("p1"), importPlaceById("p2")])
  await new Promise((resolve) => setTimeout(resolve, 20))
  release()

  expect(new Set(await both)).toEqual(new Set(["barbarock", "barbarock-2"]))
})

test("the same place imported twice at once is saved once", async () => {
  places.set("p1", place("p1", "Barbarock"))
  holdAbout()

  const both = Promise.all([importPlaceById("p1"), importPlaceById("p1")])
  await new Promise((resolve) => setTimeout(resolve, 20))
  release()

  expect(await both).toEqual(["barbarock", "barbarock"])
  const { db } = await import("@/lib/db")
  const rows = await db.select().from(businesses)
  expect(rows).toHaveLength(1)
  const hours = await db
    .select()
    .from(businessHours)
    .where(eq(businessHours.businessId, rows[0].id))
  expect(hours).toHaveLength(1)
})

test("importing an owned business again changes nothing", async () => {
  places.set("p1", place("p1", "Barbarock"))
  expect(await importPlaceById("p1")).toBe("barbarock")
  const { db } = await import("@/lib/db")
  const [saved] = await db.select().from(businesses)
  await db
    .update(businesses)
    .set({
      name: "Barbarock Studio",
      phone: "+18095550199",
      description: "Owner text",
      ownerId: "u1",
      detailsConfirmedAt: 1,
    })
    .where(eq(businesses.id, saved.id))
  await db.delete(businessHours).where(eq(businessHours.businessId, saved.id))
  await db.insert(businessHours).values({
    businessId: saved.id,
    weekday: 2,
    opensAt: "10:00",
    closesAt: "14:00",
  })
  const before = {
    business: await db.select().from(businesses),
    hours: await db.select().from(businessHours),
  }
  fetchPlace.mockClear()
  writeAbout.mockClear()

  expect(await importPlaceById("p1")).toBe("barbarock")
  expect(await importPlace("https://maps.app.goo.gl/abc")).toBe("barbarock")

  expect(fetchPlace).not.toHaveBeenCalled()
  expect(writeAbout).not.toHaveBeenCalled()
  expect({
    business: await db.select().from(businesses),
    hours: await db.select().from(businessHours),
  }).toEqual(before)
})
