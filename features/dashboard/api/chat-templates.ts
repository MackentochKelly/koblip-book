import "server-only"
import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  chatConnections,
  chatTemplates,
  koblipChatConnection,
  koblipChatTemplates,
  notificationTexts,
  platformSettingChanges,
} from "@/lib/db/schema"
import type { KoblipMessage, KoblipReview } from "@/types/koblip-messages"
import type { ChatConnection, ChatMessagesState } from "../types/chat-connection"
import {
  BOOKING_MESSAGES,
  TEMPLATE_LANGUAGES,
  bookingTemplate,
  defaultButtons,
  defaultWording,
  koblipTemplate,
  withExamples,
  type BookingMessage,
  type BookingTemplate,
  type TemplateLanguage,
} from "../utils/booking-templates"
import { ChatApiError, chatApi, chatConnectionUsable, koblipChatApi } from "./chat-oauth"

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
// only when the owner presses "Submit to Meta" (submitChatTemplate), or, for
// Koblip's ready-made set in Koblip's own workspace, the admin
// (submitKoblipTemplate, K2).

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

// One Chat workspace to call: the business's own, or Koblip's.
type ApiInit = Parameters<typeof chatApi>[2]
type Call = <T>(path: string, init?: ApiInit) => Promise<T>

const businessCall =
  (businessId: string): Call =>
  (path, init) =>
    chatApi(businessId, path, init)
const koblipCall: Call = (path, init) => koblipChatApi(path, init)

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

function listTemplates(call: Call, wabaId: string) {
  return call<Templates>(`/api/template?platform=whatsapp&waba_id=${encodeURIComponent(wabaId)}`)
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
  const list = await listTemplates(businessCall(businessId), number.wabaId)
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

// Sends one template to Meta through a workspace and returns Chat's id for
// it. A template Chat already has is changed; one Meta has but Chat lost is
// copied back first (Meta refuses the same name and language again); else
// it is made.
async function submitTo(call: Call, wabaId: string, template: BookingTemplate) {
  let list = await listTemplates(call, wabaId)
  if (!findTemplate(list, template)) {
    const meta = await call<MetaTemplates>(
      `/api/template/meta-list?waba_id=${encodeURIComponent(wabaId)}`
    )
    const lost = (meta.data ?? []).find(
      (row) => row.name === template.name && row.language === template.language
    )
    if (lost) {
      await call("/api/template/sync", {
        method: "POST",
        body: { waba_id: wabaId, meta_template_ids: [lost.id] },
      })
      list = await listTemplates(call, wabaId)
    }
  }

  const known = findTemplate(list, template)?._id
  if (known) {
    await call(`/api/template/${encodeURIComponent(known)}`, {
      method: "PUT",
      body: templateBody(template),
    })
    return known
  }
  const answer = await call<{ template_id?: string }>("/api/template/create", {
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
  if (!answer.template_id) throw new ChatApiError(502, "no_template_id")
  return answer.template_id
}

// "Submit to Meta" for one message in one language: the owner's wording and
// buttons go to Chat, which sends them to Meta for review (submitTo). Throws
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
  const chatTemplateId = await submitTo(businessCall(businessId), number.wabaId, template)
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

// Koblip's ready-made set (K2): Book's wording and buttons, the same for
// every business, in Koblip's own workspace.
function koblipTemplates(): BookingTemplate[] {
  return TEMPLATE_LANGUAGES.flatMap((language) =>
    BOOKING_MESSAGES.map((message) => koblipTemplate(message, language))
  )
}

function koblipRowKey(message: BookingMessage, language: TemplateLanguage) {
  return and(eq(koblipChatTemplates.message, message), eq(koblipChatTemplates.language, language))
}

const koblipWhere = eq(koblipChatConnection.id, "koblip")

// Koblip's usable connection and the number it sends from, saved for the
// sender; null when not connected or there is no number.
async function koblipNumber() {
  const [connection] = await db.select().from(koblipChatConnection).where(koblipWhere).limit(1)
  if (!connection || !chatConnectionUsable(connection)) return null
  const number = pickNumber(await koblipChatApi<Connections>("/api/whatsapp/connections"))
  await db
    .update(koblipChatConnection)
    .set({ wabaId: number?.wabaId ?? null, phoneNumberId: number?.phoneNumberId ?? null })
    .where(koblipWhere)
  return number
}

async function refreshKoblip() {
  const number = await koblipNumber()
  if (!number) return

  const known = await db.select().from(koblipChatTemplates)
  const reviewing = known.filter((row) => row.status !== "approved").map((row) => row.chatTemplateId)
  if (reviewing.length) {
    await koblipChatApi("/api/template/sync-status", {
      method: "POST",
      body: { waba_id: number.wabaId, template_ids: reviewing },
    })
  }

  // As for a business: Chat's copy wins, one Chat no longer has is forgotten.
  const list = await listTemplates(koblipCall, number.wabaId)
  await Promise.all(
    koblipTemplates().map(async (template) => {
      const found = findTemplate(list, template)
      if (!found) {
        await db.delete(koblipChatTemplates).where(koblipRowKey(template.message, template.language))
        return
      }
      const row = {
        chatTemplateId: found._id,
        status: found.status?.toLowerCase() ?? "pending",
        reason: found.rejection_reason ?? null,
      }
      await db
        .insert(koblipChatTemplates)
        .values({ message: template.message, language: template.language, ...row })
        .onConflictDoUpdate({
          target: [koblipChatTemplates.message, koblipChatTemplates.language],
          set: row,
        })
    })
  )
}

let refreshingKoblip: Promise<void> | null = null

// Reads Koblip's number and Meta's review of Koblip's set from Chat. Never
// creates or submits anything.
export function refreshKoblipTemplates(): Promise<void> {
  refreshingKoblip ??= refreshKoblip()
    .catch((error) => {
      if (!(error instanceof ChatApiError)) throw error
      console.error(error)
    })
    .finally(() => {
      refreshingKoblip = null
    })
  return refreshingKoblip
}

// "Submit to Meta" for one of Koblip's messages in one language, in Koblip's
// own workspace, logged in the admin change log as
// `whatsapp.koblipSubmit.<message>.<language>` with what was submitted before
// and now. Throws ChatApiError when Chat or Meta refuses.
export async function submitKoblipTemplate(
  message: BookingMessage,
  language: TemplateLanguage,
  userId: string
): Promise<SubmitProblem | null> {
  const [connection] = await db.select().from(koblipChatConnection).where(koblipWhere).limit(1)
  if (!connection || !chatConnectionUsable(connection)) return "notConnected"
  const number = await koblipNumber()
  if (!number) return "noNumber"

  const template = koblipTemplate(message, language)
  const [before] = await db.select().from(koblipChatTemplates).where(koblipRowKey(message, language))
  const chatTemplateId = await submitTo(koblipCall, number.wabaId, template)
  const row = { chatTemplateId, status: "pending", reason: null, submitted: snapshot(template) }
  await db
    .insert(koblipChatTemplates)
    .values({ message, language, ...row })
    .onConflictDoUpdate({
      target: [koblipChatTemplates.message, koblipChatTemplates.language],
      set: row,
    })
  await db.insert(platformSettingChanges).values({
    key: `whatsapp.koblipSubmit.${message}.${language}`,
    before: before?.submitted ?? null,
    after: row.submitted,
    changedBy: userId,
  })
  return null
}

// Koblip's messages as the admin reviews them: the wording and buttons each
// business gets on Koblip's number, and Meta's review, from what Book last
// saved. A message whose wording changed since it was submitted is a draft.
export async function koblipMessages(): Promise<KoblipMessage[]> {
  const rows = await db.select().from(koblipChatTemplates)
  return BOOKING_MESSAGES.map((message) => ({
    message,
    texts: Object.fromEntries(
      TEMPLATE_LANGUAGES.map((language) => {
        const wording = defaultWording(message, language)
        const buttons = defaultButtons(message, language)
        const row = rows.find((item) => item.message === message && item.language === language)
        const changed =
          !!row?.submitted &&
          JSON.stringify(row.submitted) !== JSON.stringify(snapshot(koblipTemplate(message, language)))
        const review: KoblipReview =
          !row || changed
            ? "draft"
            : row.status === "approved"
              ? "approved"
              : row.status === "rejected"
                ? "rejected"
                : "waiting"
        return [
          language,
          {
            wording,
            buttons,
            preview: withExamples(wording.body, language),
            review,
            reason: review === "rejected" ? row?.reason ?? null : null,
          },
        ]
      })
    ) as KoblipMessage["texts"],
  }))
}
