// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest"
import { newBookingClaim } from "@/lib/booking-claim"
import { bookings, businesses, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
const signedIn = {
  session: null as {
    userId: string
    name: string
    phone: string | null
    isGuest: boolean
  } | null,
}
vi.mock("@/lib/dal", () => ({ getSession: async () => signedIn.session }))

const { claimBooking } = await import("./claim-booking")
const { myBookings } = await import("./my-bookings")

// Monday 2026-06-01 08:00 in Santo Domingo.
const NOW = Date.UTC(2026, 5, 1, 12, 0)
const ANA = { userId: "u-ana", name: "Ana", phone: null, isGuest: false }
const LUIS = { userId: "u-luis", name: "Luis", phone: null, isGuest: false }

let closeDb: () => void
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-claim-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values(
    [ANA, LUIS].map((who) => ({
      id: who.userId,
      name: who.name,
      email: `${who.userId}@example.test`,
      emailVerified: true,
    }))
  )
  await db.insert(businesses).values({
    id: "biz",
    slug: "shop",
    name: "Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    status: "operational",
    seats: 1,
  })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW)
})

afterEach(() => {
  vi.restoreAllMocks()
  signedIn.session = null
})

// A booking made signed out at 10:00 tomorrow, with its claim's hash.
async function bookedSignedOut(
  id: string,
  customerUserId: string | null = null
) {
  const { db } = await import("@/lib/db")
  const claim = newBookingClaim()
  await db.insert(bookings).values({
    id,
    businessId: "biz",
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "DOP",
    startAt: "2026-06-02T14:00:00.000Z",
    endAt: "2026-06-02T14:30:00.000Z",
    customerName: "Ana",
    customerPhone: "+18095550134",
    customerUserId,
    claimTokenHash: claim.hash,
  })
  return claim.token
}

test("a booking already the account's shows on its My bookings", async () => {
  await bookedSignedOut("b-own", ANA.userId)
  const { upcoming } = await myBookings(ANA, "en", new Date(NOW))
  expect(upcoming.map((entry) => entry.id)).toEqual(["b-own"])
})

test("a booking made signed out joins the account that claims it, once", async () => {
  const bookingId = "b-claim"
  const token = await bookedSignedOut(bookingId)

  // Signed out, or a wrong secret: nothing.
  expect(await claimBooking({ bookingId, token })).toEqual({ claimed: false })
  signedIn.session = LUIS
  expect(await claimBooking({ bookingId, token: "wrong" })).toEqual({
    claimed: false,
  })

  expect(await claimBooking({ bookingId, token })).toEqual({ claimed: true })
  const { upcoming } = await myBookings(LUIS, "en", new Date(NOW))
  expect(upcoming.map((entry) => entry.id)).toEqual([bookingId])

  // The secret works once: nobody else can take it after.
  signedIn.session = ANA
  expect(await claimBooking({ bookingId, token })).toEqual({ claimed: false })
  const ana = await myBookings(ANA, "en", new Date(NOW))
  expect(ana.upcoming.map((entry) => entry.id)).not.toContain(bookingId)
})
