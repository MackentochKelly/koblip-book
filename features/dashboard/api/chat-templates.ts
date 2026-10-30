import "server-only"
import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { chatConnections, chatTemplates, notificationTexts } from "@/lib/db/schema"
import type { ChatConnection, ChatMessagesState } from "../types/chat-connection"
import {
  BOOKING_MESSAGES,
  TEMPLATE_LANGUAGES,
  bookingTemplate,
  type BookingMessage,
  type BookingTemplate,
  type TemplateLanguage,
} from "../utils/booking-templates"
import { ChatApiError, chatApi, chatConnectionUsable } from "./chat-oauth"

// Book's booking templates in the business's Koblip Chat
// (docs/koblip-chat-integration.md, step 2), through Chat's public API the
// way any app uses it: the workspace's WhatsApp numbers
// (GET /api/whatsapp/connections), its templates (GET /api/template), new
// ones (POST /api/template/create), the owner's edits (PUT /api/template/:id,
// which Chat sends back to Meta) and Meta's review status
// (POST /api/template/sync-status). See wapi-api docs/api/oauth.md.

const TEMPLATE_COUNT = BOOKING_MESSAGES.length * TEMPLATE_LANGUAGES.length

// Every template the business needs, in the owner's wording where they
// changed it.
async function businessTemplates(businessId: string): Promise<BookingTemplate[]> {
  const own = await db
    .select()
    .from(notificationTexts)
    .where(eq(notificationTexts.businessId, businessId))
  return TEMPLATE_LANGUAGES.flatMap((language) =>
    BOOKING_MESSAGES.map((message) => {
      const wording = own.find((row) => row.message === message && row.language === language)
      return bookingTemplate(message, language, wording)
    })
  )
}

// The parts of a template Chat and Meta take, with a sample for each field.
function templateBody(template: BookingTemplate) {
  return {
    header_text: template.header,
    message_body: template.metaBody,
    footer_text: template.footer,
    variable_examples: Object.fromEntries(
      template.examples.map((example, index) => [String(index + 1), example])
    ),
  }
}

type Connections = {
  data?: {
    id: string
    is_active?: boolean
    phone_numbers?: { id: string; is_active?: boolean; created_at?: string }[]
  }[]
}

type Templates = {
  data?: { _id: string; template_name: string; language: string; status?: string }[]
}

// The number Chat itself sends from when none is named: the oldest active
// number in an active WhatsApp account of the workspace (wapi-api
// docs/api/start-automation.md).
function pickNumber(connections: Connections) {
  const numbers = (connections.data ?? [])
    .filter((account) => account.is_active !== false)
    .flatMap((account) =>
      (account.phone_numbers ?? [])
        .filter((phone) => phone.is_active !== false)
        .map((phone) => ({ wabaId: account.id, phoneNumberId: phone.id, since: phone.created_at ?? "" }))
    )
    .sort((a, b) => a.since.localeCompare(b.since))
  return numbers[0] ?? null
}

async function create(businessId: string, wabaId: string, template: BookingTemplate) {
  const answer = await chatApi<{ template_id?: string }>(businessId, "/api/template/create", {
    method: "POST",
    body: {
      waba_id: wabaId,
      platform: "whatsapp",
      template_name: template.name,
      language: template.language,
      category: "UTILITY",
      ...templateBody(template),
      save_as_draft: false,
    },
  })
  return answer.template_id ?? null
}

async function setUp(businessId: string) {
  const [connection] = await db
    .select()
    .from(chatConnections)
    .where(eq(chatConnections.businessId, businessId))
    .limit(1)
  if (!connection || !chatConnectionUsable(connection)) return

  const number = pickNumber(await chatApi<Connections>(businessId, "/api/whatsapp/connections"))
  await db
    .update(chatConnections)
    .set({ wabaId: number?.wabaId ?? null, phoneNumberId: number?.phoneNumberId ?? null })
    .where(eq(chatConnections.businessId, businessId))
  if (!number) return
  const waba = encodeURIComponent(number.wabaId)

  // Meta's latest answer for templates still under review.
  const known = await db
    .select()
    .from(chatTemplates)
    .where(eq(chatTemplates.businessId, businessId))
  const reviewing = known.filter((row) => row.status !== "approved").map((row) => row.chatTemplateId)
  if (reviewing.length) {
    await chatApi(businessId, "/api/template/sync-status", {
      method: "POST",
      body: { waba_id: number.wabaId, template_ids: reviewing },
    })
  }

  // Chat's copy wins: a template already there (made earlier, or by hand) is
  // used as it is; only missing ones are made.
  const existing = await chatApi<Templates>(
    businessId,
    `/api/template?platform=whatsapp&waba_id=${waba}`
  )
  await Promise.all(
    (await businessTemplates(businessId)).map(async (template) => {
      const found = existing.data?.find(
        (row) => row.template_name === template.name && row.language === template.language
      )
      let chatTemplateId = found?._id ?? null
      let status = found?.status?.toLowerCase() ?? "pending"
      if (!chatTemplateId) {
        try {
          chatTemplateId = await create(businessId, number.wabaId, template)
          status = "pending"
        } catch (error) {
          // Left missing; the next visit tries again.
          console.error(error)
          return
        }
      }
      if (!chatTemplateId) return
      const row = { chatTemplateId, status }
      await db
        .insert(chatTemplates)
        .values({ businessId, message: template.message, language: template.language, ...row })
        .onConflictDoUpdate({
          target: [chatTemplates.businessId, chatTemplates.message, chatTemplates.language],
          set: row,
        })
    })
  )
}

// One set-up at a time per business, so a template is never made twice.
const settingUp = new Map<string, Promise<void>>()

// Makes sure the business's templates exist in Chat and reads Meta's review
// status. Safe to call again: it only makes what is missing.
export function setUpChatTemplates(businessId: string): Promise<void> {
  let pending = settingUp.get(businessId)
  if (!pending) {
    pending = setUp(businessId)
      .catch((error) => {
        // Not connected, or Chat could not be reached: nothing to do now.
        if (!(error instanceof ChatApiError)) throw error
        console.error(error)
      })
      .finally(() => settingUp.delete(businessId))
    settingUp.set(businessId, pending)
  }
  return pending
}

// Where the business's WhatsApp messages stand, from what Book last saved.
async function messagesState(businessId: string, phoneNumberId: string | null): Promise<ChatMessagesState> {
  if (!phoneNumberId) return "noNumber"
  const rows = await db
    .select({ status: chatTemplates.status })
    .from(chatTemplates)
    .where(eq(chatTemplates.businessId, businessId))
  if (rows.some((row) => row.status === "rejected")) return "rejected"
  if (rows.length < TEMPLATE_COUNT) return "settingUp"
  return rows.every((row) => row.status === "approved") ? "ready" : "waiting"
}

// What the Integrations screen may know: never a token.
export async function chatConnectionFor(businessId: string): Promise<ChatConnection | null> {
  const [row] = await db
    .select({
      workspaceName: chatConnections.workspaceName,
      needsReconnect: chatConnections.needsReconnect,
      scopes: chatConnections.scopes,
      phoneNumberId: chatConnections.phoneNumberId,
    })
    .from(chatConnections)
    .where(eq(chatConnections.businessId, businessId))
    .limit(1)
  if (!row) return null
  return {
    workspaceName: row.workspaceName,
    needsReconnect: !chatConnectionUsable(row),
    messages: await messagesState(businessId, row.phoneNumberId),
  }
}

// After the owner changes or resets a message's wording: sends it to Chat,
// which sends it to Meta for review again. A template Chat does not have yet
// is made by the next set-up instead.
export async function pushChatWording(
  businessId: string,
  message: BookingMessage,
  language: TemplateLanguage
) {
  const [row] = await db
    .select({ chatTemplateId: chatTemplates.chatTemplateId })
    .from(chatTemplates)
    .where(
      and(
        eq(chatTemplates.businessId, businessId),
        eq(chatTemplates.message, message),
        eq(chatTemplates.language, language)
      )
    )
    .limit(1)
  if (!row) return setUpChatTemplates(businessId)
  const template = (await businessTemplates(businessId)).find(
    (item) => item.message === message && item.language === language
  )!
  await chatApi(businessId, `/api/template/${encodeURIComponent(row.chatTemplateId)}`, {
    method: "PUT",
    body: templateBody(template),
  })
  await db
    .update(chatTemplates)
    .set({ status: "pending" })
    .where(
      and(
        eq(chatTemplates.businessId, businessId),
        eq(chatTemplates.message, message),
        eq(chatTemplates.language, language)
      )
    )
}

// The message as Book sends it: the owner's wording or Book's, and Chat's
// template for it when Meta approved it (else null: only plain text can go).
export async function sendableTemplate(
  businessId: string,
  message: BookingMessage,
  language: TemplateLanguage
) {
  const template = (await businessTemplates(businessId)).find(
    (item) => item.message === message && item.language === language
  )!
  const [row] = await db
    .select({ chatTemplateId: chatTemplates.chatTemplateId, status: chatTemplates.status })
    .from(chatTemplates)
    .where(
      and(
        eq(chatTemplates.businessId, businessId),
        eq(chatTemplates.message, message),
        eq(chatTemplates.language, language)
      )
    )
    .limit(1)
  return { template, chatTemplateId: row?.status === "approved" ? row.chatTemplateId : null }
}
