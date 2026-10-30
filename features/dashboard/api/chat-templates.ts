import "server-only"
import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  chatConnections,
  chatTemplates,
  koblipChatTemplates,
  notificationTexts,
} from "@/lib/db/schema"
import type { ChatConnection, ChatMessagesState } from "../types/chat-connection"
import {
  BOOKING_MESSAGES,
  TEMPLATE_LANGUAGES,
  bookingTemplate,
  koblipTemplate,
  type BookingMessage,
  type BookingTemplate,
  type TemplateLanguage,
} from "../utils/booking-templates"
import { ChatApiError, chatApi, chatConnectionUsable } from "./chat-oauth"

// Book's booking templates in the business's Koblip Chat
// (docs/koblip-chat-integration.md, step 2), through Chat's public API the
// way any app uses it: the workspace's WhatsApp numbers
// (GET /api/whatsapp/connections), its templates (GET /api/template), new
// ones (POST /api/template/create), edits (PUT /api/template/:id, which Chat
// sends back to Meta), Meta's review status and reason
// (POST /api/template/sync-status), and Meta's own list
// (GET /api/template/meta-list) to copy back any Chat lost
// (POST /api/template/sync). See wapi-api docs/api/oauth.md.
//
// Nothing goes to Meta on its own: a message is created or changed in Chat
// only when the owner presses "Submit to Meta" (submitChatTemplate).

const TEMPLATE_COUNT = BOOKING_MESSAGES.length * TEMPLATE_LANGUAGES.length

// Every template the business has, in the owner's wording and buttons where
// they changed them.
async function businessTemplates(businessId: string): Promise<BookingTemplate[]> {
  const own = await db
    .select()
    .from(notificationTexts)
    .where(eq(notificationTexts.businessId, businessId))
  return TEMPLATE_LANGUAGES.flatMap((language) =>
    BOOKING_MESSAGES.map((message) => {
      const row = own.find((item) => item.message === message && item.language === language)
      return bookingTemplate(message, language, row, row?.buttons ?? undefined)
    })
  )
}

async function businessTemplate(businessId: string, message: BookingMessage, language: TemplateLanguage) {
  return (await businessTemplates(businessId)).find(
    (item) => item.message === message && item.language === language
  )!
}

// The parts of a template Chat and Meta take, with a sample for each field.
// Each button is a quick reply whose payload is its action, which WhatsApp
// sends back when the customer taps it.
function templateBody(template: BookingTemplate) {
  return {
    header_text: template.header,
    message_body: template.metaBody,
    footer_text: template.footer,
    variable_examples: Object.fromEntries(
      template.examples.map((example, index) => [String(index + 1), example])
    ),
    buttons: template.buttons.map(({ action, label }) => ({
      type: "quick_reply",
      text: label,
      payload: action,
    })),
  }
}

// What was submitted to Meta, kept to send the approved template as it is.
function snapshot(template: BookingTemplate) {
  const { header, body, footer, buttons } = template
  return { header, body, footer, buttons }
}

type Connections = {
  data?: {
    id: string
    is_active?: boolean
    phone_numbers?: { id: string; is_active?: boolean; created_at?: string }[]
  }[]
}

type Templates = {
  data?: {
    _id: string
    template_name: string
    language: string
    status?: string
    rejection_reason?: string | null
  }[]
}

type MetaTemplates = { data?: { id: string; name: string; language: string }[] }

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

// The business's usable connection and the number it sends from, saved for
// the sender; null when not connected or there is no number.
async function chatNumber(businessId: string) {
  const [connection] = await db
    .select()
    .from(chatConnections)
    .where(eq(chatConnections.businessId, businessId))
    .limit(1)
  if (!connection || !chatConnectionUsable(connection)) return null

  const number = pickNumber(await chatApi<Connections>(businessId, "/api/whatsapp/connections"))
  await db
    .update(chatConnections)
    .set({ wabaId: number?.wabaId ?? null, phoneNumberId: number?.phoneNumberId ?? null })
    .where(eq(chatConnections.businessId, businessId))
  return number
}

function listTemplates(businessId: string, wabaId: string) {
  return chatApi<Templates>(
    businessId,
    `/api/template?platform=whatsapp&waba_id=${encodeURIComponent(wabaId)}`
  )
}

function findTemplate(list: Templates, template: BookingTemplate) {
  return list.data?.find(
    (row) => row.template_name === template.name && row.language === template.language
  )
}

function rowKey(businessId: string, message: BookingMessage, language: TemplateLanguage) {
  return and(
    eq(chatTemplates.businessId, businessId),
    eq(chatTemplates.message, message),
    eq(chatTemplates.language, language)
  )
}

async function refresh(businessId: string) {
  const number = await chatNumber(businessId)
  if (!number) return

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

  // Chat's copy wins: a template it has under Book's name (submitted
  // earlier, or made by hand) is kept with Meta's status and reason. Nothing
  // is made here.
  const list = await listTemplates(businessId, number.wabaId)
  await Promise.all(
    (await businessTemplates(businessId)).map(async (template) => {
      const found = findTemplate(list, template)
      // One Chat no longer has (deleted, or under an earlier name) is
      // forgotten: the message is back to not submitted.
      if (!found) {
        await db.delete(chatTemplates).where(rowKey(businessId, template.message, template.language))
        return
      }
      const row = {
        chatTemplateId: found._id,
        status: found.status?.toLowerCase() ?? "pending",
        reason: found.rejection_reason ?? null,
      }
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

// One refresh at a time per business.
const refreshing = new Map<string, Promise<void>>()

// Reads the business's number and Meta's review of its templates from Chat.
// Never creates or submits anything.
export function refreshChatTemplates(businessId: string): Promise<void> {
  let pending = refreshing.get(businessId)
  if (!pending) {
    pending = refresh(businessId)
      .catch((error) => {
        // Not connected, or Chat could not be reached: nothing to do now.
        if (!(error instanceof ChatApiError)) throw error
        console.error(error)
      })
      .finally(() => refreshing.delete(businessId))
    refreshing.set(businessId, pending)
  }
  return pending
}

export type SubmitProblem = "notConnected" | "noNumber"

// "Submit to Meta" for one message in one language: the owner's wording and
// buttons go to Chat, which sends them to Meta for review. A template Chat
// already has is changed; one Meta has but Chat lost is copied back first
// (Meta refuses the same name and language again); else it is made. Throws
// ChatApiError when Chat or Meta refuses.
export async function submitChatTemplate(
  businessId: string,
  message: BookingMessage,
  language: TemplateLanguage
): Promise<SubmitProblem | null> {
  const [connection] = await db
    .select()
    .from(chatConnections)
    .where(eq(chatConnections.businessId, businessId))
    .limit(1)
  if (!connection || !chatConnectionUsable(connection)) return "notConnected"
  const number = await chatNumber(businessId)
  if (!number) return "noNumber"

  const template = await businessTemplate(businessId, message, language)
  let list = await listTemplates(businessId, number.wabaId)
  if (!findTemplate(list, template)) {
    const meta = await chatApi<MetaTemplates>(
      businessId,
      `/api/template/meta-list?waba_id=${encodeURIComponent(number.wabaId)}`
    )
    const lost = (meta.data ?? []).find(
      (row) => row.name === template.name && row.language === template.language
    )
    if (lost) {
      await chatApi(businessId, "/api/template/sync", {
        method: "POST",
        body: { waba_id: number.wabaId, meta_template_ids: [lost.id] },
      })
      list = await listTemplates(businessId, number.wabaId)
    }
  }

  let chatTemplateId = findTemplate(list, template)?._id ?? null
  if (chatTemplateId) {
    await chatApi(businessId, `/api/template/${encodeURIComponent(chatTemplateId)}`, {
      method: "PUT",
      body: templateBody(template),
    })
  } else {
    const answer = await chatApi<{ template_id?: string }>(businessId, "/api/template/create", {
      method: "POST",
      body: {
        waba_id: number.wabaId,
        platform: "whatsapp",
        template_name: template.name,
        language: template.language,
        category: "UTILITY",
        ...templateBody(template),
        save_as_draft: false,
      },
    })
    chatTemplateId = answer.template_id ?? null
    if (!chatTemplateId) throw new ChatApiError(502, "no_template_id")
  }

  const row = { chatTemplateId, status: "pending", reason: null, submitted: snapshot(template) }
  await db
    .insert(chatTemplates)
    .values({ businessId, message, language, ...row })
    .onConflictDoUpdate({
      target: [chatTemplates.businessId, chatTemplates.message, chatTemplates.language],
      set: row,
    })
  return null
}

// Where the business's WhatsApp messages stand, from what Book last saved.
async function messagesState(businessId: string, phoneNumberId: string | null): Promise<ChatMessagesState> {
  if (!phoneNumberId) return "noNumber"
  const rows = await db
    .select({ status: chatTemplates.status })
    .from(chatTemplates)
    .where(eq(chatTemplates.businessId, businessId))
  if (rows.some((row) => row.status === "rejected")) return "rejected"
  if (rows.length < TEMPLATE_COUNT) return "notSubmitted"
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

// The message as Book sends it: `template` in the owner's current wording
// (for a normal message inside the 24-hour window), and `approved`, the
// template exactly as Meta approved it with Chat's id, or null when Meta has
// not approved it.
export async function sendableTemplate(
  businessId: string,
  message: BookingMessage,
  language: TemplateLanguage
) {
  const template = await businessTemplate(businessId, message, language)
  const [row] = await db
    .select()
    .from(chatTemplates)
    .where(rowKey(businessId, message, language))
    .limit(1)
  if (row?.status !== "approved") return { template, approved: null }
  return {
    template,
    approved: {
      chatTemplateId: row.chatTemplateId,
      template: row.submitted
        ? bookingTemplate(message, language, row.submitted, row.submitted.buttons)
        : template,
    },
  }
}

// Whether Meta approved the business's own copy of each of these messages in
// every language: then its own number can send them all (K3).
export async function ownTemplatesApproved(businessId: string, messages: BookingMessage[]) {
  if (!messages.length) return true
  const rows = await db
    .select({ message: chatTemplates.message })
    .from(chatTemplates)
    .where(
      and(
        eq(chatTemplates.businessId, businessId),
        eq(chatTemplates.status, "approved"),
        inArray(chatTemplates.message, messages)
      )
    )
  return rows.length === messages.length * TEMPLATE_LANGUAGES.length
}

// The same as sendableTemplate, from Koblip's ready-made set in Koblip's own
// workspace, for a business sending from Koblip's number.
export async function koblipSendableTemplate(message: BookingMessage, language: TemplateLanguage) {
  const template = koblipTemplate(message, language)
  const [row] = await db
    .select()
    .from(koblipChatTemplates)
    .where(and(eq(koblipChatTemplates.message, message), eq(koblipChatTemplates.language, language)))
    .limit(1)
  if (row?.status !== "approved") return { template, approved: null }
  return {
    template,
    approved: {
      chatTemplateId: row.chatTemplateId,
      template: row.submitted
        ? koblipTemplate(message, language, row.submitted, row.submitted.buttons)
        : template,
    },
  }
}
