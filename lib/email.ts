import "server-only"

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"
import { and, eq, isNull, or } from "drizzle-orm"
import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"

import { db } from "@/lib/db"
import { emailBlocks, emailSends } from "@/lib/db/schema"
import {
  normalEmail,
  type EmailKind,
  type EmailSendReason,
} from "@/lib/email-rules"
import type { PageLanguage } from "@/lib/page-language"

// Email goes through Amazon SES's API (docs/plans/email.md, EM-D2), with
// nodemailer's SES transport (nodemailer.com/transports/ses). The AWS SDK
// reads AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY itself.
// SES_CONFIGURATION_SET names the set whose events come back to
// /api/email/events; without it emails still go, with no events.

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html: string
  // The name it comes from (a booking's email: the business's), at
  // EMAIL_FROM's address. EMAIL_FROM's own name when not given.
  fromName?: string
  attachments?: { filename: string; content: string; contentType: string }[]
  // Where mail apps' unsubscribe button posts (RFC 8058): a customer
  // email's "Stop emails" (lib/email-stop.ts).
  oneClickStop?: string
}

// What an email is and whom it is about, for the log (EM-D4).
export interface EmailMeta {
  kind: EmailKind
  userId?: string | null
  businessId?: string | null
  bookingId?: string | null
  // A booking's reminder: minutes before the visit, and the booking's moves.
  reminderMinutes?: number
  moves?: number
  language?: PageLanguage | null
}

let transporter: Transporter | null = null
let warnedMissing = false

function isConfigured(): boolean {
  return Boolean(
    process.env.AWS_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.EMAIL_FROM
  )
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      SES: {
        sesClient: new SESv2Client({ region: process.env.AWS_REGION }),
        SendEmailCommand,
      },
    })
  }
  return transporter
}

// Whether an address gets no more email: blocked for every business, or
// for this one (EM-D5).
export async function isBlocked(
  email: string,
  businessId: string | null = null
): Promise<boolean> {
  const scope = businessId
    ? or(isNull(emailBlocks.businessId), eq(emailBlocks.businessId, businessId))
    : isNull(emailBlocks.businessId)
  const [row] = await db
    .select({ id: emailBlocks.id })
    .from(emailBlocks)
    .where(and(eq(emailBlocks.email, normalEmail(email)), scope))
    .limit(1)
  return Boolean(row)
}

// Writes an email's row before it goes. Null when that booking's email of
// this kind, reminder time and move is there already: it never goes twice.
export async function claimEmail(
  to: string,
  meta: EmailMeta
): Promise<string | null> {
  const [row] = await db
    .insert(emailSends)
    .values({
      kind: meta.kind,
      email: normalEmail(to),
      userId: meta.userId ?? null,
      businessId: meta.businessId ?? null,
      bookingId: meta.bookingId ?? null,
      reminderMinutes: meta.reminderMinutes ?? 0,
      moves: meta.moves ?? 0,
      language: meta.language ?? null,
      state: "sending",
    })
    .onConflictDoNothing()
    .returning({ id: emailSends.id })
  return row?.id ?? null
}

// EMAIL_FROM's address, without its name: "Koblip Book <contact@koblip.com>"
// → contact@koblip.com.
function fromAddress(from: string): string {
  return from.match(/<([^>]+)>/)?.[1]?.trim() ?? from.trim()
}

// Takes a planned email (pending) to send it now. False when another check
// took it first.
export async function claimPlannedEmail(sendId: string): Promise<boolean> {
  const [row] = await db
    .update(emailSends)
    .set({ state: "sending" })
    .where(and(eq(emailSends.id, sendId), eq(emailSends.state, "pending")))
    .returning({ id: emailSends.id })
  return Boolean(row)
}

export async function settleEmail(
  sendId: string,
  outcome:
    | { state: "sent"; messageId: string }
    | { state: "failed" | "skipped"; reason: EmailSendReason }
) {
  await db
    .update(emailSends)
    .set(
      outcome.state === "sent"
        ? {
            state: "sent",
            messageId: outcome.messageId,
            sentAt: new Date().toISOString(),
          }
        : { state: outcome.state, reason: outcome.reason }
    )
    .where(eq(emailSends.id, sendId))
}

// Sends an email whose row claimEmail wrote, and records how it went.
// Returns whether it went.
export async function deliverEmail(
  sendId: string,
  message: EmailMessage,
  businessId: string | null = null
): Promise<boolean> {
  if (await isBlocked(message.to, businessId)) {
    await settleEmail(sendId, { state: "skipped", reason: "blocked" })
    return false
  }
  if (!isConfigured()) {
    if (!warnedMissing) {
      warnedMissing = true
      console.warn("Email is not set up")
    }
    await settleEmail(sendId, { state: "skipped", reason: "notSetUp" })
    return false
  }
  try {
    const configurationSet = process.env.SES_CONFIGURATION_SET
    const from = process.env.EMAIL_FROM as string
    const info = await getTransporter().sendMail({
      from: message.fromName
        ? { name: message.fromName, address: fromAddress(from) }
        : from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.attachments?.length ? { attachments: message.attachments } : {}),
      ...(message.oneClickStop && {
        list: { unsubscribe: message.oneClickStop },
        headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
      ...(configurationSet && {
        ses: { ConfigurationSetName: configurationSet },
      }),
    })
    // The SES transport puts Amazon's own message id in `response`: the id
    // its events name.
    await settleEmail(sendId, { state: "sent", messageId: String(info.response) })
    return true
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    await settleEmail(sendId, { state: "failed", reason: "sendFailed" })
    return false
  }
}

// Sends one email and logs it. Never throws: without SES keys it warns
// once and skips (so local dev works); a failure is logged and recorded.
// Returns whether it went.
export async function sendEmail(
  message: EmailMessage,
  meta: EmailMeta
): Promise<boolean> {
  try {
    const sendId = await claimEmail(message.to, meta)
    if (!sendId) return false
    return await deliverEmail(sendId, message, meta.businessId ?? null)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return false
  }
}
