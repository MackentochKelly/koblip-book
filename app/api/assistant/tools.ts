import "server-only"

import type { AssistantTool } from "@/features/assistant/types"
import {
  serverMessagesFor,
  type ServerMessages,
} from "@/features/assistant/i18n/server"
import type { PageLanguage } from "@/lib/page-language"
import {
  cancelBooking,
  createService,
  deleteService,
  deleteTeamMember,
  renameTeamMember,
  saveHours,
  updateService,
} from "@/features/dashboard/api/actions"
import { setBookingStatus } from "@/features/dashboard/api/booking-actions"
import {
  getBookingCounts,
  getBookings,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import {
  getCustomerBookings,
  getCustomers,
} from "@/features/dashboard/api/customers"
import { logAssistantAction } from "@/features/assistant/api/audit-log"
import { createOwnerBooking } from "@/features/booking/api/create-owner-booking"
import { getAvailability } from "@/features/booking/api/get-availability"
import { BOOKING_RULES, PHONE_PATTERN } from "@/lib/booking-rules"
import {
  formatClock,
  formatDay,
  formatWeekday,
} from "@/lib/format-booking-time"
import { formatPrice } from "@/lib/format-price"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const STATUSES = ["confirmed", "cancelled", "completed", "no_show"] as const
const SETTABLE_STATUSES = ["confirmed", "completed", "no_show"] as const

// YYYY-MM-DD of today in the business timezone.
function zonedToday(now: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value
      return acc
    }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

function addDaysStr(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`
}

function isRealDate(date: string): boolean {
  if (!DATE_RE.test(date)) {
    return false
  }
  const [year, month, day] = date.split("-").map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  )
}

function schema(
  properties: Record<string, unknown>,
  required: string[] = []
): Record<string, unknown> {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  }
}

function bad(message: string): { error: string } {
  return { error: message }
}

function asRecord(args: unknown): Record<string, unknown> | null {
  return typeof args === "object" && args !== null
    ? (args as Record<string, unknown>)
    : null
}

// Trimmed text within 1..max, or null.
function validName(value: unknown, max: number): string | null {
  if (typeof value !== "string") {
    return null
  }
  const name = value.trim()
  return name.length >= 1 && name.length <= max ? name : null
}

// One of the durations the booking screens offer, or null.
function validMinutes(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    (BOOKING_RULES.serviceMinutes as readonly number[]).includes(value)
    ? value
    : null
}

// Minor units of the business currency, null = no price, "invalid" = reject.
function validPriceMinor(value: unknown): number | null | "invalid" {
  if (value === null) {
    return null
  }
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= BOOKING_RULES.maxPriceMinor
    ? value
    : "invalid"
}

export interface HoursInput {
  weekday: number
  opensAt: string
  closesAt: string
}

// At most 14 rows of weekday 0-6 with open and close HH:mm, or null.
function validHoursRows(value: unknown): HoursInput[] | null {
  if (!Array.isArray(value) || value.length > 14) {
    return null
  }
  const rows: HoursInput[] = []
  for (const row of value) {
    const r = asRecord(row)
    if (
      !r ||
      !Number.isInteger(r.weekday) ||
      (r.weekday as number) < 0 ||
      (r.weekday as number) > 6 ||
      typeof r.opensAt !== "string" ||
      !TIME_RE.test(r.opensAt) ||
      typeof r.closesAt !== "string" ||
      !TIME_RE.test(r.closesAt)
    ) {
      return null
    }
    rows.push({
      weekday: r.weekday as number,
      opensAt: r.opensAt,
      closesAt: r.closesAt,
    })
  }
  return rows
}

// Checked arguments for create_booking, shared by describe and execute.
interface CheckedBooking {
  service: { id: string; name: string; priceMinor: number | null }
  memberId: string | null
  memberName: string
  date: string
  time: string
  name: string
  phone: string | null
  note: string | null
  price: string
  timeZone: string
}

async function checkBookingArgs(
  businessId: string,
  args: unknown,
  t: ServerMessages,
  now = Date.now()
): Promise<CheckedBooking | { error: string }> {
  const a = asRecord(args)
  if (!a || typeof a.serviceId !== "string" || a.serviceId === "") {
    return { error: t.errors.serviceIdRequired }
  }
  const memberId =
    a.teamMemberId === undefined || a.teamMemberId === null
      ? null
      : a.teamMemberId
  if (memberId !== null && (typeof memberId !== "string" || memberId === "")) {
    return { error: t.errors.teamMemberInvalid }
  }
  if (typeof a.date !== "string" || !isRealDate(a.date)) {
    return { error: t.errors.dateInvalid }
  }
  if (typeof a.time !== "string" || !TIME_RE.test(a.time)) {
    return { error: t.errors.timeInvalid }
  }
  const name = validName(a.name, BOOKING_RULES.maxCustomerName)
  if (!name) {
    return { error: t.errors.nameRequired }
  }
  const phoneRaw = a.phone === undefined || a.phone === null ? "" : a.phone
  if (typeof phoneRaw !== "string") {
    return { error: t.errors.phoneInvalid }
  }
  const phone = phoneRaw.trim() === "" ? null : phoneRaw.trim()
  if (phone !== null && !PHONE_PATTERN.test(phone)) {
    return { error: t.errors.phoneInvalid }
  }
  const noteRaw = a.note === undefined || a.note === null ? "" : a.note
  if (typeof noteRaw !== "string") {
    return { error: t.errors.noteInvalid }
  }
  const note = noteRaw.trim() === "" ? null : noteRaw.trim()
  if (note !== null && note.length > BOOKING_RULES.maxNote) {
    return { error: t.errors.noteTooLong }
  }
  const { business, services, team } = await getOwnerBusiness(businessId)
  if (a.date < zonedToday(now, business.timezone)) {
    return { error: t.errors.datePast }
  }
  const service = services.find((s) => s.id === a.serviceId)
  if (!service) {
    return { error: t.errors.serviceUnknown }
  }
  const member = memberId === null ? null : team.find((m) => m.id === memberId)
  if (memberId !== null && !member) {
    return { error: t.errors.memberUnknown }
  }
  return {
    service: {
      id: service.id,
      name: service.name,
      priceMinor: service.priceMinor,
    },
    memberId,
    memberName: member?.name ?? t.booking.anyone,
    date: a.date,
    time: a.time,
    name,
    phone,
    note,
    price:
      service.priceMinor === null
        ? t.booking.noPrice
        : service.priceMinor === 0
          ? t.booking.free
          : formatPrice(service.priceMinor, business.currency, t.locale),
    timeZone: business.timezone,
  }
}

// Checked arguments for update_service, shared by describe and execute.
interface CheckedServiceUpdate {
  current: {
    id: string
    name: string
    description: string | null
    durationMinutes: number
    priceMinor: number | null
  }
  name: string
  durationMinutes: number
  priceMinor: number | null
  description: string | null
  currency: string
}

// Missing or blank means no description; too long or wrong type rejects.
function validDescription(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== "string") {
    return "invalid"
  }
  const trimmed = value.trim()
  if (trimmed === "") {
    return null
  }
  return trimmed.length <= BOOKING_RULES.maxServiceDescription
    ? trimmed
    : "invalid"
}

// Tools closed over the checked businessId and ownerId. The model never
// sees or sets either. Lists drop rows past the cap and always
// report total + truncated, so the model never claims a capped list
// is complete.
export function buildAssistantTools(
  businessId: string,
  ownerId: string,
  language: PageLanguage
): AssistantTool[] {
  // Every owner-facing line in the owner's language.
  const t = serverMessagesFor(language)
  // Every write is audited with a server-built summary, ok and failed.
  // Best-effort: a failed row never breaks the owner's action.
  const audit = async (
    tool: string,
    summary: string,
    status: "ok" | "failed"
  ): Promise<void> => {
    try {
      await logAssistantAction({ businessId, ownerId, tool, summary, status })
    } catch {
      // The action already happened; the row is nice to have.
    }
  }
  // Shared checks for update_service: describe and execute both use this,
  // re-reading the service each time because it may change between calls.
  const checkUpdateServiceArgs = async (
    args: unknown
  ): Promise<CheckedServiceUpdate | { error: string }> => {
    const a = asRecord(args)
    if (!a || typeof a.serviceId !== "string" || a.serviceId === "") {
      return { error: t.errors.serviceIdRequired }
    }
    const { business, services } = await getOwnerBusiness(businessId)
    const current = services.find((s) => s.id === a.serviceId)
    if (!current) {
      return { error: t.errors.serviceUnknown }
    }
    const name =
      a.name === undefined
        ? current.name
        : validName(a.name, BOOKING_RULES.maxServiceName)
    if (!name) {
      return { error: t.errors.nameInvalid }
    }
    const durationMinutes =
      a.minutes === undefined
        ? current.durationMinutes
        : validMinutes(a.minutes)
    if (!durationMinutes) {
      return {
        error: t.errors.minutesInvalid(
          (BOOKING_RULES.serviceMinutes as readonly number[]).join(", ")
        ),
      }
    }
    const priceMinor =
      a.priceMinor === undefined
        ? current.priceMinor
        : validPriceMinor(a.priceMinor)
    if (priceMinor === "invalid") {
      return { error: t.errors.priceInvalid }
    }
    const description =
      a.description === undefined
        ? current.description
        : validDescription(a.description)
    if (description === "invalid") {
      return { error: t.errors.descriptionInvalid }
    }
    return {
      current: {
        id: current.id,
        name: current.name,
        description: current.description ?? null,
        durationMinutes: current.durationMinutes,
        priceMinor: current.priceMinor ?? null,
      },
      name,
      durationMinutes,
      priceMinor,
      description,
      currency: business.currency,
    }
  }
  // Price text like the booking card: localized money, or No price.
  const describePrice = (priceMinor: number | null, currency: string): string =>
    priceMinor === null
      ? t.booking.noPrice
      : priceMinor === 0
        ? t.booking.free
        : formatPrice(priceMinor, currency, t.locale)
  return [
    {
      definition: {
        name: "business_overview",
        description: "Name, address, phone, hours, and today's booking counts.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t.steps.overview,
      run: async () => {
        const [{ business, hours }, counts] = await Promise.all([
          getOwnerBusiness(businessId),
          getBookingCounts(businessId),
        ])
        return {
          name: business.name,
          address: business.address,
          phone: business.phone,
          timezone: business.timezone,
          currency: business.currency,
          hours: hours.map((h) => ({
            weekday: h.weekday,
            opensAt: h.opensAt,
            closesAt: h.closesAt,
          })),
          todayBookings: counts.today,
          upcomingBookings: counts.upcoming,
        }
      },
    },
    {
      definition: {
        name: "list_services",
        description: "All services with duration and price.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t.steps.services,
      run: async () => {
        const { services } = await getOwnerBusiness(businessId)
        const rows = services.map((s) => ({
          id: s.id,
          name: s.name,
          durationMinutes: s.durationMinutes,
          priceMinor: s.priceMinor,
        }))
        const capped = rows.slice(0, 50)
        return {
          services: capped,
          total: rows.length,
          truncated: rows.length > capped.length,
        }
      },
    },
    {
      definition: {
        name: "list_team",
        description: "All team members.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t.steps.team,
      run: async () => {
        const { team } = await getOwnerBusiness(businessId)
        const rows = team.map((m) => ({ id: m.id, name: m.name }))
        const capped = rows.slice(0, 50)
        return {
          team: capped,
          total: rows.length,
          truncated: rows.length > capped.length,
        }
      },
    },
    {
      definition: {
        name: "list_bookings",
        description:
          "Bookings, upcoming (soonest first) or past (most recent first). Source caps: next 200 upcoming, last 100 past.",
        parameters: schema({
          range: { type: "string", enum: ["upcoming", "past"] },
          from: {
            type: "string",
            description: "YYYY-MM-DD in the business timezone",
          },
          to: {
            type: "string",
            description: "YYYY-MM-DD in the business timezone",
          },
          status: { type: "string", enum: [...STATUSES] },
        }),
        needsConfirm: false,
      },
      label: t.steps.bookings,
      run: async (args: unknown) => {
        const a = (args ?? {}) as Record<string, unknown>
        const range = a.range ?? "upcoming"
        if (range !== "upcoming" && range !== "past") {
          return bad(t.errors.rangeInvalid)
        }
        for (const key of ["from", "to"] as const) {
          if (
            a[key] !== undefined &&
            (typeof a[key] !== "string" || !DATE_RE.test(a[key]))
          ) {
            return bad(t.errors.dayInvalid(key))
          }
        }
        if (
          a.status !== undefined &&
          !STATUSES.includes(a.status as (typeof STATUSES)[number])
        ) {
          return bad(t.errors.statusUnknown)
        }
        const rows = await getBookings(businessId, range)
        const filtered = rows.filter(
          (b) =>
            (a.from === undefined || b.date >= (a.from as string)) &&
            (a.to === undefined || b.date <= (a.to as string)) &&
            (a.status === undefined || b.status === a.status)
        )
        const capped = filtered.slice(0, 25).map((b) => ({
          id: b.id,
          date: b.date,
          time: b.time,
          service: b.serviceName,
          customer: b.customerName,
          phone: b.customerPhone,
          status: b.status,
        }))
        return {
          bookings: capped,
          total: filtered.length,
          truncated: filtered.length > capped.length,
        }
      },
    },
    {
      definition: {
        name: "find_customer",
        description:
          "Find customers by name or phone. Returns visits, no-shows, next and last booking.",
        parameters: schema(
          { query: { type: "string", description: "Name or phone text" } },
          ["query"]
        ),
        needsConfirm: false,
      },
      label: t.steps.customer,
      run: async (args: unknown) => {
        const query = (args as Record<string, unknown> | null)?.query
        if (
          typeof query !== "string" ||
          query.trim().length === 0 ||
          query.length > 80
        ) {
          return bad(t.errors.queryInvalid)
        }
        const q = query.trim().toLowerCase()
        const digits = q.replace(/\D/g, "")
        const all = await getCustomers(businessId)
        const matched = all.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (digits.length > 0 &&
              (c.phone ?? "").replace(/\D/g, "").includes(digits))
        )
        const capped = matched.slice(0, 5)
        const entries = await Promise.all(
          capped.map(async (c) => {
            const recent = await getCustomerBookings(businessId, c.key)
            return {
              name: c.name,
              phone: c.phone,
              bookings: c.bookings,
              completed: c.completed,
              noShows: c.noShows,
              cancelled: c.cancelled,
              lastVisit: c.lastVisit,
              nextBooking: c.nextBooking,
              recent: recent.slice(0, 3).map((b) => ({
                date: b.date,
                time: b.time,
                service: b.serviceName,
                status: b.status,
              })),
            }
          })
        )
        return {
          customers: entries,
          total: matched.length,
          truncated: matched.length > entries.length,
        }
      },
    },
    {
      definition: {
        name: "create_service",
        description:
          "Create a service. Price is in minor units of the business currency (null = no price).",
        parameters: schema(
          {
            name: {
              type: "string",
              description: "Service name, 1-80 characters",
            },
            minutes: {
              type: "integer",
              description: `Duration, one of ${(BOOKING_RULES.serviceMinutes as readonly number[]).join(", ")}`,
            },
            priceMinor: {
              type: ["integer", "null"],
              description: "Price in minor units, or null for no price",
            },
            description: {
              type: "string",
              description: "Optional, max 300 characters",
            },
          },
          ["name", "minutes", "priceMinor"]
        ),
        needsConfirm: false,
      },
      label: t.steps.createService,
      run: async (args: unknown) => {
        const a = asRecord(args)
        const name = a && validName(a.name, BOOKING_RULES.maxServiceName)
        if (!name) {
          return bad(t.errors.nameInvalid)
        }
        const minutes = a && validMinutes(a.minutes)
        if (!minutes) {
          return bad(
            t.errors.minutesInvalid(
              (BOOKING_RULES.serviceMinutes as readonly number[]).join(", ")
            )
          )
        }
        const price =
          a && "priceMinor" in a ? validPriceMinor(a.priceMinor) : "invalid"
        if (price === "invalid") {
          return bad(t.errors.priceInvalid)
        }
        const description = a ? validDescription(a.description) : "invalid"
        if (description === "invalid") {
          return bad(t.errors.descriptionInvalid)
        }
        const result = await createService(businessId, {
          name,
          description,
          durationMinutes: minutes,
          priceMinor: price,
        })
        if (!result.ok) {
          await audit(
            "create_service",
            `create "${name}" failed: ${result.error}`,
            "failed"
          )
          return { error: result.error }
        }
        await audit("create_service", `created "${name}"`, "ok")
        return { created: { id: result.id, name } }
      },
    },
    {
      definition: {
        name: "update_service",
        description:
          "Change a service. Use the id from list_services; only the given fields change. Needs the owner's tap.",
        parameters: schema({
          serviceId: { type: "string", description: "Id from list_services" },
          name: { type: "string", description: "New name, 1-80 characters" },
          minutes: {
            type: "integer",
            description: `New duration, one of ${(BOOKING_RULES.serviceMinutes as readonly number[]).join(", ")}`,
          },
          priceMinor: {
            type: ["integer", "null"],
            description: "New price in minor units, or null for no price",
          },
          description: {
            type: "string",
            description: "New description, max 300 characters",
          },
        }),
        needsConfirm: true,
        resultKind: "services",
      },
      label: t.steps.updateService,
      run: async () => ({ error: t.tapFirst.updateService }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkUpdateServiceArgs(args)
          if ("error" in checked) {
            return checked
          }
          const parts: string[] = []
          const nameChanged = checked.name !== checked.current.name
          if (nameChanged) {
            parts.push(`${checked.current.name} → ${checked.name}`)
          }
          if (checked.priceMinor !== checked.current.priceMinor) {
            parts.push(
              `${describePrice(checked.current.priceMinor, checked.currency)} → ${describePrice(checked.priceMinor, checked.currency)}`
            )
          }
          if (checked.durationMinutes !== checked.current.durationMinutes) {
            parts.push(
              `${t.booking.minutes(checked.current.durationMinutes)} → ${t.booking.minutes(checked.durationMinutes)}`
            )
          }
          const oldDescription = checked.current.description ?? null
          const newDescription = checked.description ?? null
          if (oldDescription !== newDescription) {
            parts.push(`${oldDescription ?? ""} → ${newDescription ?? ""}`)
          }
          if (parts.length === 0) {
            return { error: t.updateService.nothing }
          }
          return {
            title: t.cards.updateService,
            action: t.actions.updateService,
            summary: nameChanged
              ? parts.join(" · ")
              : `${checked.current.name} · ${parts.join(" · ")}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkUpdateServiceArgs(args)
          if ("error" in checked) {
            if (
              checked.error === t.errors.serviceUnknown ||
              checked.error === t.errors.serviceIdRequired
            ) {
              return { ok: false, doneText: t.updateService.unknown }
            }
            return {
              ok: false,
              doneText: t.updateService.failed(checked.error),
            }
          }
          const result = await updateService(businessId, checked.current.id, {
            name: checked.name,
            description: checked.description,
            durationMinutes: checked.durationMinutes,
            priceMinor: checked.priceMinor,
          })
          if (!result.ok) {
            return {
              ok: false,
              doneText: t.updateService.failed(result.error),
            }
          }
          return { ok: true, doneText: t.updateService.done }
        },
      },
    },
    {
      definition: {
        name: "rename_team_member",
        description: "Rename a team member. Use the id from list_team.",
        parameters: schema(
          {
            memberId: { type: "string", description: "Id from list_team" },
            name: { type: "string", description: "New name, 1-80 characters" },
          },
          ["memberId", "name"]
        ),
        needsConfirm: false,
      },
      label: t.steps.renameMember,
      run: async (args: unknown) => {
        const a = asRecord(args)
        if (!a || typeof a.memberId !== "string" || a.memberId === "") {
          return bad(t.errors.memberIdRequired)
        }
        const name = validName(a.name, 80)
        if (!name) {
          return bad(t.errors.nameInvalid)
        }
        const result = await renameTeamMember(businessId, a.memberId, name)
        if (!result.ok) {
          await audit(
            "rename_team_member",
            `rename failed: ${result.error}`,
            "failed"
          )
          return { error: result.error }
        }
        await audit("rename_team_member", `renamed to "${name}"`, "ok")
        return { renamed: { id: a.memberId, name } }
      },
    },
    {
      definition: {
        name: "set_booking_status",
        description:
          "Mark a booking confirmed, completed or no_show. Use the id from list_bookings. Cannot cancel.",
        parameters: schema(
          {
            bookingId: { type: "string", description: "Id from list_bookings" },
            status: { type: "string", enum: [...SETTABLE_STATUSES] },
          },
          ["bookingId", "status"]
        ),
        needsConfirm: false,
      },
      label: t.steps.setBookingStatus,
      run: async (args: unknown) => {
        const a = asRecord(args)
        if (!a || typeof a.bookingId !== "string" || a.bookingId === "") {
          return bad(t.errors.bookingIdRequired)
        }
        if (
          !SETTABLE_STATUSES.includes(
            a.status as (typeof SETTABLE_STATUSES)[number]
          )
        ) {
          return bad(t.errors.statusInvalid)
        }
        const result = await setBookingStatus(
          businessId,
          a.bookingId,
          a.status as (typeof SETTABLE_STATUSES)[number]
        )
        if (!result.ok) {
          await audit(
            "set_booking_status",
            `${a.bookingId} failed: ${result.error}`,
            "failed"
          )
          return { error: result.error }
        }
        await audit("set_booking_status", `${a.bookingId} -> ${a.status}`, "ok")
        return { updated: { id: a.bookingId, status: a.status } }
      },
    },
    {
      definition: {
        name: "cancel_booking",
        description:
          "Cancel a booking. Use the id from list_bookings. Needs the owner's tap.",
        parameters: schema(
          {
            bookingId: { type: "string", description: "Id from list_bookings" },
          },
          ["bookingId"]
        ),
        needsConfirm: true,
        resultKind: "bookings",
      },
      label: t.steps.cancelBooking,
      run: async () => ({ error: t.tapFirst.cancel }),
      confirm: {
        describe: async (args: unknown) => {
          const a = asRecord(args)
          if (!a || typeof a.bookingId !== "string" || a.bookingId === "") {
            return { error: t.errors.bookingIdRequired }
          }
          const [upcoming, past] = await Promise.all([
            getBookings(businessId, "upcoming"),
            getBookings(businessId, "past"),
          ])
          const booking = [...upcoming, ...past].find(
            (b) => b.id === a.bookingId
          )
          if (!booking) {
            return { error: t.errors.bookingUnknown }
          }
          return {
            title: t.cards.cancel,
            action: t.actions.cancelBooking,
            summary: `${booking.customerName} · ${booking.serviceName} · ${formatDay(booking.date, t.locale)} · ${formatClock(booking.time, t.locale)}`,
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const a = asRecord(args)
          const bookingId = a?.bookingId
          if (typeof bookingId !== "string" || bookingId === "") {
            return { ok: false, doneText: t.cancel.unknown }
          }
          const result = await cancelBooking(businessId, bookingId)
          if (!result.ok) {
            return {
              ok: false,
              doneText: t.cancel.failed(result.error),
            }
          }
          return { ok: true, doneText: t.cancel.done }
        },
      },
    },
    {
      definition: {
        name: "delete_service",
        description:
          "Delete a service. Use the id from list_services. Needs the owner's tap.",
        parameters: schema(
          {
            serviceId: { type: "string", description: "Id from list_services" },
          },
          ["serviceId"]
        ),
        needsConfirm: true,
        resultKind: "services",
      },
      label: t.steps.deleteService,
      run: async () => ({ error: t.tapFirst.deleteService }),
      confirm: {
        describe: async (args: unknown) => {
          const a = asRecord(args)
          if (!a || typeof a.serviceId !== "string" || a.serviceId === "") {
            return { error: t.errors.serviceIdRequired }
          }
          const { services } = await getOwnerBusiness(businessId)
          const service = services.find((s) => s.id === a.serviceId)
          if (!service) {
            return { error: t.errors.serviceUnknown }
          }
          return {
            title: t.cards.deleteService,
            action: t.actions.deleteService,
            summary: `${service.name} · ${t.booking.minutes(service.durationMinutes)}`,
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const a = asRecord(args)
          const serviceId = a?.serviceId
          if (typeof serviceId !== "string" || serviceId === "") {
            return { ok: false, doneText: t.deleteService.unknown }
          }
          const result = await deleteService(businessId, serviceId)
          if (!result.ok) {
            return {
              ok: false,
              doneText: t.deleteService.failed(result.error),
            }
          }
          return { ok: true, doneText: t.deleteService.done }
        },
      },
    },
    {
      definition: {
        name: "delete_team_member",
        description:
          "Remove a team member. Use the id from list_team. Needs the owner's tap.",
        parameters: schema(
          { memberId: { type: "string", description: "Id from list_team" } },
          ["memberId"]
        ),
        needsConfirm: true,
        resultKind: "team",
      },
      label: t.steps.deleteMember,
      run: async () => ({ error: t.tapFirst.deleteMember }),
      confirm: {
        describe: async (args: unknown) => {
          const a = asRecord(args)
          if (!a || typeof a.memberId !== "string" || a.memberId === "") {
            return { error: t.errors.memberIdRequired }
          }
          const { team } = await getOwnerBusiness(businessId)
          const member = team.find((m) => m.id === a.memberId)
          if (!member) {
            return { error: t.errors.memberUnknown }
          }
          return {
            title: t.cards.deleteMember,
            action: t.actions.deleteMember,
            summary: member.name,
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const a = asRecord(args)
          const memberId = a?.memberId
          if (typeof memberId !== "string" || memberId === "") {
            return {
              ok: false,
              doneText: t.deleteMember.unknown,
            }
          }
          const result = await deleteTeamMember(businessId, memberId)
          if (!result.ok) {
            return {
              ok: false,
              doneText: t.deleteMember.failed(result.error),
            }
          }
          return { ok: true, doneText: t.deleteMember.done }
        },
      },
    },
    {
      definition: {
        name: "set_hours",
        description:
          "Replace the opening hours. At most 14 rows; each row is a weekday (0 Sunday to 6 Saturday) with open and close HH:mm. Needs the owner's tap.",
        parameters: schema(
          {
            rows: {
              type: "array",
              description: "New weekly hours, at most 14 rows",
              items: {
                type: "object",
                properties: {
                  weekday: { type: "integer" },
                  opensAt: { type: "string" },
                  closesAt: { type: "string" },
                },
                required: ["weekday", "opensAt", "closesAt"],
                additionalProperties: false,
              },
            },
          },
          ["rows"]
        ),
        needsConfirm: true,
        resultKind: "hours",
      },
      label: t.steps.hours,
      run: async () => ({
        error: t.tapFirst.hours,
      }),
      confirm: {
        describe: async (args: unknown) => {
          const rows = validHoursRows(asRecord(args)?.rows)
          if (!rows) {
            return { error: t.errors.rowsInvalid }
          }
          const lines = [...rows]
            .sort((x, y) => x.weekday - y.weekday)
            .map(
              (r) =>
                `${formatWeekday(r.weekday, t.locale)} ${r.opensAt}–${r.closesAt}`
            )
          return {
            title: t.cards.hours,
            action: t.actions.hours,
            summary:
              lines.length > 0 ? lines.join(", ") : t.booking.closedWeek,
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const rows = validHoursRows(asRecord(args)?.rows)
          if (!rows) {
            return { ok: false, doneText: t.hours.invalid }
          }
          const result = await saveHours(businessId, rows)
          if (!result.ok) {
            return {
              ok: false,
              doneText: t.hours.failed(result.error),
            }
          }
          return { ok: true, doneText: t.hours.done }
        },
      },
    },
    {
      definition: {
        name: "find_free_times",
        description:
          "Free start times per day for a service. Use ids from list_services and list_team. Default is today plus 6 days.",
        parameters: schema({
          serviceId: { type: "string", description: "Id from list_services" },
          teamMemberId: {
            type: "string",
            description: "Id from list_team, omit for anyone",
          },
          from: {
            type: "string",
            description: "YYYY-MM-DD in the business timezone",
          },
          to: {
            type: "string",
            description: "YYYY-MM-DD in the business timezone",
          },
        }),
        needsConfirm: false,
      },
      label: t.steps.freeTimes,
      run: async (args: unknown) => {
        const a = asRecord(args)
        if (!a || typeof a.serviceId !== "string" || a.serviceId === "") {
          return bad(t.errors.serviceIdRequired)
        }
        const teamMemberId =
          a.teamMemberId === undefined || a.teamMemberId === null
            ? null
            : a.teamMemberId
        if (
          teamMemberId !== null &&
          (typeof teamMemberId !== "string" || teamMemberId === "")
        ) {
          return bad(t.errors.teamMemberInvalid)
        }
        const { business } = await getOwnerBusiness(businessId)
        const today = zonedToday(Date.now(), business.timezone)
        const from = a.from === undefined ? today : a.from
        const to = a.to === undefined ? addDaysStr(today, 6) : a.to
        if (typeof from !== "string" || !isRealDate(from) || from < today) {
          return bad(t.errors.fromInvalid)
        }
        if (typeof to !== "string" || !isRealDate(to) || to < from) {
          return bad(t.errors.toInvalid)
        }
        const spanDays = (Date.parse(to) - Date.parse(from)) / 86_400_000
        if (spanDays > 13) {
          return bad(t.errors.spanInvalid)
        }
        const found = await getAvailability(
          business.slug,
          a.serviceId,
          teamMemberId,
          []
        )
        if (!found) {
          return bad(t.errors.freeTimesUnknown)
        }
        const inRange = found.days.filter((d) => d.date >= from && d.date <= to)
        const capped = inRange.slice(0, 14)
        return {
          days: capped,
          total: inRange.length,
          truncated: inRange.length > capped.length,
        }
      },
    },
    {
      definition: {
        name: "create_booking",
        description:
          "Book an appointment for a CUSTOMER. name is the customer being booked, never a team member; teamMemberId (omit for anyone) is who performs the service. Only offer times find_free_times returned. Needs the owner's tap.",
        parameters: schema(
          {
            serviceId: { type: "string", description: "Id from list_services" },
            teamMemberId: {
              type: "string",
              description: "Id from list_team, omit for anyone",
            },
            date: {
              type: "string",
              description: "YYYY-MM-DD in the business timezone",
            },
            time: {
              type: "string",
              description: "HH:mm in the business timezone",
            },
            name: { type: "string", description: "Customer name" },
            phone: {
              type: "string",
              description: "Customer phone, omit when unknown",
            },
            note: { type: "string", description: "Optional note" },
          },
          ["serviceId", "date", "time", "name"]
        ),
        needsConfirm: true,
        resultKind: "bookings",
      },
      label: t.steps.booking,
      run: async () => ({ error: t.tapFirst.booking }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkBookingArgs(businessId, args, t)
          if ("error" in checked) {
            return checked
          }
          return {
            title: t.cards.book,
            action: t.actions.book,
            summary:
              `${checked.name} · ${checked.service.name} · ` +
              `${formatDay(checked.date, t.locale)} · ${formatClock(checked.time, t.locale)} · ` +
              `${checked.memberName} · ${checked.price}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkBookingArgs(businessId, args, t)
          if ("error" in checked) {
            return {
              ok: false,
              doneText: t.booking.couldNotBook(checked.error),
            }
          }
          // allowConflict is always false: the model can never double-book.
          const result = await createOwnerBooking({
            businessId,
            serviceId: checked.service.id,
            teamMemberId: checked.memberId,
            addonIds: [],
            date: checked.date,
            time: checked.time,
            name: checked.name,
            phone: checked.phone,
            note: checked.note,
            allowConflict: false,
          })
          const when = t.booking.at(
            formatDay(checked.date, t.locale),
            formatClock(checked.time, t.locale)
          )
          if (result.status === "booked") {
            return {
              ok: true,
              doneText: t.booking.booked(
                checked.name,
                checked.service.name,
                when
              ),
            }
          }
          if (result.status === "conflict") {
            return {
              ok: false,
              doneText: t.booking.couldNotBook(
                result.reason === "closed"
                  ? t.booking.conflictClosed
                  : t.booking.conflictTaken
              ),
            }
          }
          if (result.status === "invalid") {
            const fields: Record<string, string> = { ...t.booking.fields }
            return {
              ok: false,
              doneText: t.booking.couldNotBook(
                fields[result.field] ?? t.booking.invalidFallback
              ),
            }
          }
          return { ok: false, doneText: t.booking.failed }
        },
      },
    },
  ]
}
