// @vitest-environment node
import { execFileSync } from "node:child_process"
import { createSign } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"

import { db } from "@/lib/db"
import { emailBlocks, emailSends } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const TOPIC = "arn:aws:sns:us-east-1:123456789012:koblip-book-email"
const CERT_URL = "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-test.pem"
const SUBSCRIBE_URL =
  "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=x&Token=t"

let dir: string
let key: string
let certificate: string
const fetchMock = vi.fn()

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-email-events-test-"))
  // A throwaway signing certificate, standing in for Amazon's.
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=sns.amazonaws.com",
    "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"),
  ], { stdio: "ignore" })
  key = readFileSync(join(dir, "key.pem"), "utf8")
  certificate = readFileSync(join(dir, "cert.pem"), "utf8")
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  process.env.SES_EVENTS_TOPIC_ARN = TOPIC
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  vi.stubGlobal("fetch", fetchMock)
})

beforeEach(async () => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string) =>
    url === CERT_URL ? new Response(certificate) : new Response("ok")
  )
  await db.delete(emailBlocks)
  await db.delete(emailSends)
  await db.insert(emailSends).values({
    id: "send-1",
    kind: "verification",
    email: "ana@example.com",
    state: "sent",
    messageId: "ses-1",
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

// An SNS message signed the way Amazon signs it (SignatureVersion 2).
function signed(fields: Record<string, string>) {
  const message: Record<string, string> = {
    MessageId: "m-1",
    TopicArn: TOPIC,
    Timestamp: new Date().toISOString(),
    SignatureVersion: "2",
    SigningCertURL: CERT_URL,
    ...fields,
  }
  const keys =
    message.Type === "Notification"
      ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
      : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"]
  const text = keys
    .filter((name) => message[name] !== undefined)
    .map((name) => `${name}\n${message[name]}\n`)
    .join("")
  message.Signature = createSign("RSA-SHA256").update(text).sign(key, "base64")
  return message
}

function sesEvent(event: Record<string, unknown>) {
  return signed({
    Type: "Notification",
    Message: JSON.stringify({ mail: { messageId: "ses-1" }, ...event }),
  })
}

async function post(body: unknown) {
  const { POST } = await import("./route")
  return POST(
    new Request("http://localhost/api/email/events", {
      method: "POST",
      body: JSON.stringify(body),
    })
  )
}

const HARD_BOUNCE = {
  eventType: "Bounce",
  bounce: {
    bounceType: "Permanent",
    bouncedRecipients: [{ emailAddress: "Ana@Example.com" }],
  },
}

test("a hard bounce marks the email and blocks the address everywhere", async () => {
  const response = await post(sesEvent(HARD_BOUNCE))
  expect(response.status).toBe(204)
  const [send] = await db.select().from(emailSends)
  expect(send?.delivery).toBe("bounced")
  const blocks = await db.select().from(emailBlocks)
  expect(blocks.map((row) => [row.email, row.businessId, row.reason, row.sendId])).toEqual([
    ["ana@example.com", null, "bounce", "send-1"],
  ])
  // The same event again changes nothing.
  expect((await post(sesEvent(HARD_BOUNCE))).status).toBe(204)
  expect(await db.select().from(emailBlocks)).toHaveLength(1)
})

test("a complaint blocks; a delivery is recorded; a late delivery never replaces a bounce", async () => {
  await post(sesEvent({ eventType: "Delivery", delivery: { timestamp: "2026-11-11T00:00:00.000Z" } }))
  let [send] = await db.select().from(emailSends)
  expect([send?.delivery, send?.deliveryAt]).toEqual(["delivered", "2026-11-11T00:00:00.000Z"])

  await post(
    sesEvent({
      eventType: "Complaint",
      complaint: { complainedRecipients: [{ emailAddress: "ana@example.com" }] },
    })
  )
  await post(sesEvent({ eventType: "DeliveryDelay" }))
  ;[send] = await db.select().from(emailSends)
  expect(send?.delivery).toBe("complained")
  const [block] = await db.select().from(emailBlocks)
  expect(block?.reason).toBe("complaint")
})

test("a soft bounce blocks nothing", async () => {
  await post(sesEvent({ ...HARD_BOUNCE, bounce: { ...HARD_BOUNCE.bounce, bounceType: "Transient" } }))
  const [send] = await db.select().from(emailSends)
  expect(send?.delivery).toBe("delayed")
  expect(await db.select().from(emailBlocks)).toHaveLength(0)
})

test("a changed message, another topic or a foreign certificate host is refused", async () => {
  const changed = sesEvent(HARD_BOUNCE)
  changed.Message = changed.Message.replace("Permanent", "Transient")
  expect((await post(changed)).status).toBe(403)

  expect((await post({ ...sesEvent(HARD_BOUNCE), TopicArn: "arn:aws:sns:us-east-1:1:other" })).status).toBe(403)

  const foreign = signed({
    Type: "Notification",
    Message: "{}",
    SigningCertURL: "https://sns.us-east-1.amazonaws.com.evil.example/cert.pem",
  })
  expect((await post(foreign)).status).toBe(403)
  expect(await db.select().from(emailBlocks)).toHaveLength(0)
})

test("the subscription is confirmed by visiting Amazon's link", async () => {
  const response = await post(
    signed({
      Type: "SubscriptionConfirmation",
      Message: "You have chosen to subscribe",
      SubscribeURL: SUBSCRIBE_URL,
      Token: "t",
    })
  )
  expect(response.status).toBe(204)
  expect(fetchMock).toHaveBeenCalledWith(SUBSCRIBE_URL)
})
