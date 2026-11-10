// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { businesses, paymentMethods } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const { getPaymentDetails } = await import("./payment-details")

let closeDb: () => void
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-payment-details-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  const shop = (id: string, paymentProof: boolean) => ({
    id,
    slug: id,
    name: id,
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    paymentProof,
  })
  await db.insert(businesses).values([shop("asks", true), shop("plain", false)])
  const zelle = (businessId: string) => ({
    id: `${businessId}-zelle`,
    businessId,
    type: "zelle" as const,
    name: "Zelle",
    details: `pay@${businessId}.example`,
  })
  await db.insert(paymentMethods).values([zelle("asks"), zelle("plain")])
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("a business that asks for payment proof says where to send the money", async () => {
  await expect(getPaymentDetails("asks", "asks-zelle")).resolves.toBe("pay@asks.example")
})

test("nothing for a business that does not ask, another business's way, or a way that is not there", async () => {
  await expect(getPaymentDetails("plain", "plain-zelle")).resolves.toBeNull()
  await expect(getPaymentDetails("asks", "plain-zelle")).resolves.toBeNull()
  await expect(getPaymentDetails("asks", "nothing")).resolves.toBeNull()
})
