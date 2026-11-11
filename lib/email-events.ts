import "server-only"

import { createVerify, X509Certificate } from "node:crypto"
import { eq } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"

import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { emailBlocks, emailSends } from "@/lib/db/schema"
import { normalEmail, type EmailDelivery } from "@/lib/email-rules"

// Amazon SES's events for Book's emails come back through SNS
// (docs/plans/email.md, EM-D3): configuration set → SNS topic →
// POST /api/email/events. Every message is checked against Amazon's
// signature before anything is done with it
// (docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html).

export type SnsMessage = {
  Type: string
  MessageId: string
  TopicArn: string
  Message: string
  Timestamp: string
  SignatureVersion: string
  Signature: string
  SigningCertURL: string
  Subject?: string
  SubscribeURL?: string
  Token?: string
}

// Only Amazon's own SNS hosts sign messages or take confirmations.
function isSnsUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(url.hostname)
    )
  } catch {
    return false
  }
}

// The fields Amazon signs, in its order, for each kind of message.
function stringToSign(message: SnsMessage): string | null {
  const keys: (keyof SnsMessage)[] =
    message.Type === "Notification"
      ? message.Subject === undefined
        ? ["Message", "MessageId", "Timestamp", "TopicArn", "Type"]
        : ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
      : message.Type === "SubscriptionConfirmation" ||
          message.Type === "UnsubscribeConfirmation"
        ? ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"]
        : []
  if (!keys.length) return null
  let text = ""
  for (const key of keys) {
    const value = message[key]
    if (typeof value !== "string") return null
    text += `${key}\n${value}\n`
  }
  return text
}

const certificates = new Map<string, X509Certificate>()

async function signingCertificate(url: string): Promise<X509Certificate | null> {
  const cached = certificates.get(url)
  if (cached) return cached
  const response = await fetch(url)
  if (!response.ok) return null
  const certificate = new X509Certificate(await response.text())
  certificates.set(url, certificate)
  return certificate
}

// Whether a message really comes from Amazon SNS, for Book's own topic.
export async function verifySnsMessage(body: unknown): Promise<SnsMessage | null> {
  if (!body || typeof body !== "object") return null
  const message = body as SnsMessage
  const topic = process.env.SES_EVENTS_TOPIC_ARN
  if (!topic || message.TopicArn !== topic) return null
  if (!isSnsUrl(message.SigningCertURL)) return null
  const algorithm =
    message.SignatureVersion === "1"
      ? "RSA-SHA1"
      : message.SignatureVersion === "2"
        ? "RSA-SHA256"
        : null
  const text = stringToSign(message)
  if (!algorithm || !text || typeof message.Signature !== "string") return null
  try {
    const certificate = await signingCertificate(message.SigningCertURL)
    if (!certificate) return null
    const now = Date.now()
    if (
      now < Date.parse(certificate.validFrom) ||
      now > Date.parse(certificate.validTo)
    ) {
      return null
    }
    const verifier = createVerify(algorithm)
    verifier.update(text, "utf8")
    return verifier.verify(certificate.publicKey, message.Signature, "base64")
      ? message
      : null
  } catch {
    return null
  }
}

// Confirms Book's subscription to the topic: Amazon sends this once when
// the subscription is made.
export async function confirmSubscription(message: SnsMessage): Promise<boolean> {
  if (!isSnsUrl(message.SubscribeURL)) return false
  const response = await fetch(message.SubscribeURL)
  return response.ok
}

type SesEvent = {
  eventType?: string
  mail?: { messageId?: string; timestamp?: string }
  bounce?: {
    bounceType?: string
    bouncedRecipients?: { emailAddress?: string }[]
    timestamp?: string
  }
  complaint?: {
    complainedRecipients?: { emailAddress?: string }[]
    timestamp?: string
  }
  delivery?: { timestamp?: string }
  deliveryDelay?: { timestamp?: string }
}

function addresses(list: { emailAddress?: string }[] | undefined): string[] {
  return (list ?? [])
    .map((row) => row.emailAddress)
    .filter((value): value is string => typeof value === "string")
    .map(normalEmail)
}

// What one SES event means for the log, and which addresses it blocks
// everywhere (EM-D5): a hard bounce or a complaint.
function readEvent(
  event: SesEvent
): { delivery: EmailDelivery; at?: string; block: string[]; reason?: "bounce" | "complaint" } | null {
  switch (event.eventType) {
    case "Delivery":
      return { delivery: "delivered", at: event.delivery?.timestamp, block: [] }
    case "DeliveryDelay":
      return { delivery: "delayed", at: event.deliveryDelay?.timestamp, block: [] }
    case "Reject":
      return { delivery: "rejected", block: [] }
    case "Bounce": {
      // A soft bounce may still go later: only a hard one blocks.
      const hard = event.bounce?.bounceType === "Permanent"
      return hard
        ? {
            delivery: "bounced",
            at: event.bounce?.timestamp,
            block: addresses(event.bounce?.bouncedRecipients),
            reason: "bounce",
          }
        : { delivery: "delayed", at: event.bounce?.timestamp, block: [] }
    }
    case "Complaint":
      return {
        delivery: "complained",
        at: event.complaint?.timestamp,
        block: addresses(event.complaint?.complainedRecipients),
        reason: "complaint",
      }
    default:
      return null
  }
}

// Records one SES event: the email's delivery, and any address it blocks.
// Applying the same event twice changes nothing.
export async function applySesEvent(raw: string): Promise<void> {
  let event: SesEvent
  try {
    event = JSON.parse(raw) as SesEvent
  } catch {
    return
  }
  const read = readEvent(event)
  const messageId = event.mail?.messageId
  if (!read || !messageId) return
  const [send] = await db
    .select({ id: emailSends.id, delivery: emailSends.delivery })
    .from(emailSends)
    .where(eq(emailSends.messageId, messageId))
    .limit(1)
  const writes: BatchItem<"sqlite">[] = []
  // A bounce or complaint is final: a late delivery or delay never
  // replaces it.
  const final = send?.delivery === "bounced" || send?.delivery === "complained"
  if (send && (!final || read.reason)) {
    writes.push(
      db
        .update(emailSends)
        .set({
          delivery: read.delivery,
          deliveryAt: read.at ?? new Date().toISOString(),
        })
        .where(eq(emailSends.id, send.id))
    )
  }
  const reason = read.reason
  if (reason && read.block.length) {
    writes.push(
      db
        .insert(emailBlocks)
        .values(
          read.block.map((email) => ({
            email,
            businessId: null,
            reason,
            sendId: send?.id ?? null,
          }))
        )
        .onConflictDoNothing()
    )
  }
  await saveAll(writes)
}
