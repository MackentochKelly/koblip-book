import "server-only"
import { and, asc, desc, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  automationEvents, automationPauses, automationRuns, automations, bookings, businesses,
  chatConnections, notificationSends, services,
} from "@/lib/db/schema"
import { notify } from "@/lib/in-app-notifications"
import { whatsappCustomerKeys } from "@/lib/whatsapp-phone"
import { automationRules, notificationRules } from "@/lib/platform-settings"
import { runInTurn } from "@/lib/run-in-turn"
import { fillFields } from "@/lib/message-fields"
import type { AutomationLanguage, AutomationRun } from "../types/automations"
import { automationEvent, type AutomationEvent } from "../utils/automation-events"
import { automationProblem, type AutomationMessageInput } from "../utils/automation-rules"
import { chatApi, chatConnectionUsable } from "./chat-oauth"
import { post, type Line } from "./notification-sender"
import { automationCustomerWhere, claimAutomationEvent, pauseAutomationCustomer, bookSendReceipt, waitForBookSends } from "./automation-state"

type Flow = typeof automations.$inferSelect
type Connection = typeof chatConnections.$inferSelect
type Context = {
  event: AutomationEvent
  connection: Connection
  flow: Flow
  language: AutomationLanguage
  name: string | null
  business: typeof businesses.$inferSelect
}

function customerRun(context: Pick<Context, "connection" | "event">) {
  const { connection, event } = context
  return and(
    eq(automationRuns.businessId, connection.businessId),
    eq(automationRuns.workspaceId, event.workspaceId),
    eq(automationRuns.phoneNumberId, connection.phoneNumberId!),
    eq(automationRuns.customerPhone, event.customerPhone)
  )
}

async function record(context: Context, step: AutomationRun["step"], state: AutomationRun["state"], reason: string | null, chatRecordId: string | null = null) {
  await db.insert(automationRuns).values({
    businessId: context.connection.businessId, automationId: context.flow.id,
    workspaceId: context.event.workspaceId, phoneNumberId: context.connection.phoneNumberId!,
    eventId: context.event.eventId, customerPhone: context.event.customerPhone,
    customerName: context.name, language: context.language, step, state, reason,
    chatRecordId,
  })
}

// The saved source of a choice must be a message this customer's number
// actually received. Chat record IDs are not WhatsApp message IDs.
async function parentRun(connection: Connection, event: AutomationEvent) {
  if (!event.replyToMessageId) return null
  const [row] = await db.select().from(automationRuns).where(and(
    customerRun({ connection, event }),
    eq(automationRuns.chatMessageId, event.replyToMessageId),
    eq(automationRuns.state, "sent")
  )).orderBy(desc(automationRuns.at), desc(automationRuns.id)).limit(1)
  return row ?? null
}

async function send(context: Context, step: AutomationRun["step"], message: AutomationMessageInput | { type: "text"; body: string }) {
  const rules = await automationRules()
  // Chat's current list transport trims at maxBody, even though Meta allows
  // maxListBody. Fail visibly rather than silently truncating stored wording.
  const problem = message.type === "text"
    ? automationProblem({ type: "button", body: message.body,
      buttons: context.flow.buttons.map((button) => ({ id: button.id, label: button.label[context.language] })) }, rules)
    : automationProblem(message, message.type === "list" ? { ...rules, maxListBody: Math.min(rules.maxListBody, rules.maxBody) } : rules)
  if (problem) {
    await record(context, step, "failed", problem.error)
    return
  }
  const line: Line = {
    sender: "own", workspaceId: context.event.workspaceId,
    phoneNumberId: context.connection.phoneNumberId!,
    call: (path, init) => chatApi(context.connection.businessId, path, init),
  }
  const outcome = await post(line, context.event.customerPhone, context.name ?? "", "text", (recipient) => {
    if (message.type === "text") return { ...recipient, messageType: "text", messageText: message.body }
    const common = { ...recipient, messageType: "interactive", interactiveType: message.type, messageText: message.body }
    if (message.type === "button") return { ...common, buttonParams: message.buttons!.map(({ id, label }) => ({ id, title: label })) }
    if (message.type === "cta_url") return { ...common, buttonParams: { display_text: message.label, url: message.url } }
    return { ...common, listParams: { body: message.body, buttonTitle: message.label, sections: message.sections } }
  }, { logErrors: false })
  // A failed contact lookup is not retried by an event redelivery either.
  // Provider explanations are not stored: they can contain private content.
  await record(context, step, outcome.state === "pending" ? "failed" : outcome.state,
    outcome.state === "sent" ? null : outcome.state === "pending" ? "chat" : outcome.reason,
    outcome.state === "sent" ? outcome.chatRecordId : null)
}

function publicUrl(context: Context, booking: boolean) {
  const base = process.env.BETTER_AUTH_URL
  if (!base) throw new Error("Missing site URL")
  const url = new URL(`/b/${encodeURIComponent(context.business.slug)}${booking ? "/book" : ""}`, base)
  url.searchParams.set("lang", context.language)
  if (!booking) url.hash = "services"
  return url.toString()
}

async function applyOutbound(connection: Connection, event: AutomationEvent) {
  await waitForBookSends(event.workspaceId)
  if (event.recordId) {
    const [own] = await db.select().from(automationRuns).where(and(
      customerRun({ connection, event }), eq(automationRuns.chatRecordId, event.recordId)
    )).limit(1)
    if (own) {
      if (event.messageId) await db.update(automationRuns).set({ chatMessageId: event.messageId }).where(eq(automationRuns.id, own.id))
      return
    }
    const [bookingSend] = await db.select({ id: notificationSends.id }).from(notificationSends).where(and(
      eq(notificationSends.businessId, connection.businessId), eq(notificationSends.sender, "own"),
      eq(notificationSends.chatRecordId, event.recordId)
    )).limit(1)
    if (bookingSend) return
    const [receipt] = await db.select({ eventId: automationEvents.eventId }).from(automationEvents).where(and(
      eq(automationEvents.businessId, connection.businessId), eq(automationEvents.workspaceId, event.workspaceId),
      eq(automationEvents.eventId, bookSendReceipt(event.recordId))
    )).limit(1)
    if (receipt) return
  }
  await saveAll([pauseAutomationCustomer(connection.businessId, connection.phoneNumberId!, event, (await automationRules()).handoffQuietHours)])
}

async function applyInbound(connection: Connection, event: AutomationEvent, previousReplyAt: string | null) {
  const rules = await automationRules()
  const [business] = await db.select().from(businesses).where(eq(businesses.id, connection.businessId)).limit(1)
  if (!business || business.isDemo || !business.ownerId) return
  const [latestBooking] = await db.select({ language: bookings.language, name: bookings.customerName }).from(bookings)
    .where(and(eq(bookings.businessId, business.id), inArray(bookings.customerKey, whatsappCustomerKeys(event.customerPhone))))
    .orderBy(desc(bookings.createdAt), desc(bookings.id)).limit(1)
  const parent = event.payload ? await parentRun(connection, event) : null
  const flows = await db.select().from(automations).where(and(eq(automations.businessId, business.id), eq(automations.on, true)))
  for (const flow of flows) {
    const language = parent?.language ?? (latestBooking?.language === "es" ? "es" : "en")
    const context: Context = { event, connection, flow, language, name: latestBooking?.name ?? null, business }
    let step: AutomationRun["step"] = "welcome"
    try {
      const [pause] = await db.select().from(automationPauses).where(automationCustomerWhere(business.id, connection.phoneNumberId!, event)).limit(1)
      if (pause && Date.parse(pause.until) > Date.now()) {
        await record(context, step, "skipped", "paused")
        continue
      }
      const window = await notificationRules(business.id)
      const age = Date.now() - Date.parse(event.at)
      if (age < 0 || age >= window.freeTextMinutes * 60 * 1000) {
        await record(context, step, "skipped", "windowClosed")
        continue
      }
      const invalid = automationProblem({ wording: flow.wording, buttons: flow.buttons }, rules)
      if (invalid) {
        await record(context, step, "failed", invalid.error)
        continue
      }
      const words = flow.wording[language]
      const fill = (text: string) => fillFields(text, { business: business.name })
      if (event.payload) {
        if (!parent || parent.automationId !== flow.id) continue
        const servicePrefix = `automation-service:${flow.id}:`
        if (event.payload.startsWith(servicePrefix) && parent.step === "servicesList") {
          step = "serviceLink"
          const [service] = await db.select().from(services).where(and(eq(services.businessId, business.id), eq(services.id, event.payload.slice(servicePrefix.length)))).limit(1)
          const button = flow.buttons.find((item) => item.action.type === "servicesList")
          if (!service || !button) continue
          await send(context, step, { type: "cta_url", body: service.name, label: button.label[language], url: publicUrl(context, false) })
          continue
        }
        if (parent.step !== "welcome") continue
        const button = flow.buttons.find((item) => item.id === event.payload)
        if (!button) continue
        step = button.action.type
        if (button.action.type === "handoff") {
          await saveAll([pauseAutomationCustomer(business.id, connection.phoneNumberId!, event, rules.handoffQuietHours)])
          await notify(business.id, "customerReplied", { customerName: context.name ?? undefined, customerPhone: event.customerPhone },
            { dedupeKey: `automation-handoff:${event.eventId}` })
          await send(context, step, { type: "text", body: fill(words.handoffReply) })
        } else if (button.action.type === "bookingLink") {
          await send(context, step, { type: "cta_url", body: button.label[language], label: button.label[language], url: publicUrl(context, true) })
        } else {
          const ownServices = await db.select().from(services).where(eq(services.businessId, business.id))
            .orderBy(asc(services.position), asc(services.id)).limit(rules.maxListRows)
          if (!ownServices.length) {
            await record(context, step, "skipped", "noServices")
            continue
          }
          const rows = ownServices.map((service) => ({ id: `${servicePrefix}${service.id}`, title: service.name }))
          await send(context, step, { type: "list", body: fill(words.servicesIntro), label: button.label[language], sections: [{ rows }] })
        }
      } else {
        if (event.replyToMessageId || flow.trigger !== "firstMessage") continue
        const [lastTry] = await db.select({ state: automationRuns.state }).from(automationRuns).where(and(
          customerRun(context), eq(automationRuns.automationId, flow.id), eq(automationRuns.step, "welcome"), inArray(automationRuns.state, ["sent", "failed"])
        )).orderBy(desc(automationRuns.at), desc(automationRuns.id)).limit(1)
        const [lastWelcome] = await db.select({ at: automationRuns.at }).from(automationRuns).where(and(
          customerRun(context), eq(automationRuns.automationId, flow.id), eq(automationRuns.step, "welcome"), eq(automationRuns.state, "sent")
        )).orderBy(desc(automationRuns.at)).limit(1)
        const baseline = Math.max(previousReplyAt ? Date.parse(previousReplyAt) : -Infinity,
          lastWelcome ? Date.parse(lastWelcome.at) : -Infinity)
        // A Welcome that failed never reached them: their next message tries again.
        if (lastTry?.state !== "failed" && Date.parse(event.at) - baseline <= rules.welcomeAgainDays * 24 * 60 * 60 * 1000) continue
        await send(context, step, { type: "button", body: fill(words.body), buttons: flow.buttons.map((button) => ({ id: button.id, label: button.label[language] })) })
      }
    } catch {
      // Even a failed diagnostic write must never escape the webhook.
      try { await record(context, step, "failed", "error") } catch { /* no private diagnostics */ }
    }
  }
}

// One source workspace is serialized through send+record, so an outbound
// callback racing the send response can recognize Book's own stored record.
export async function runAutomations(value: unknown, previousReplyAt: string | null): Promise<void> {
  try {
    const event = automationEvent(value)
    if (!event) return
    await runInTurn(`automation-events:${event.workspaceId}`, async () => {
      const candidates = (await db.select().from(chatConnections).where(eq(chatConnections.workspaceId, event.workspaceId)))
        .filter((row) => chatConnectionUsable(row) && !!row.phoneNumberId && !!row.accessToken && !!row.refreshToken &&
          row.scopes.split(" ").includes("conversations") && (!event.phoneNumberId || row.phoneNumberId === event.phoneNumberId))
      // An inbound message must identify exactly one business/number.
      if (event.type === "inbound" && candidates.length !== 1) return
      for (const connection of candidates) {
        if (!(await claimAutomationEvent(connection.businessId, connection.phoneNumberId!, event))) continue
        if (event.type === "outbound") await applyOutbound(connection, event)
        else await applyInbound(connection, event, previousReplyAt)
      }
    })
  } catch {
    // D9: never throw or log webhook content, phone numbers or provider errors.
  }
}
