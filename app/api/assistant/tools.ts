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
  createTeamMember,
  deleteService,
  deleteTeamMember,
  renameTeamMember,
  saveHours,
  updateBusinessDetails,
  updateService,
} from "@/features/dashboard/api/actions"
import {
  createAddonGroup,
  deleteAddonGroup,
  updateAddonGroup,
} from "@/features/dashboard/api/addon-actions"
import {
  setMemberServices,
  setServiceTeam,
} from "@/features/dashboard/api/team-services"
import { setBookingStatus } from "@/features/dashboard/api/booking-actions"
import {
  daysInRange,
  getBookingCounts,
  getBookings,
  getBookingsBetween,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import {
  getCustomerBookings,
  getCustomers,
} from "@/features/dashboard/api/customers"
import { getAddonGroups } from "@/features/dashboard/api/addon-queries"
import {
  getBusinessPhotos,
  getServiceTeams,
} from "@/features/dashboard/api/team-service-queries"
import { getTranslationStatus } from "@/features/dashboard/api/translation-queries"
import { logAssistantAction } from "@/features/assistant/api/audit-log"
import { createOwnerBooking } from "@/features/booking/api/create-owner-booking"
import { getAvailability } from "@/features/booking/api/get-availability"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { bookingStats } from "./booking-stats"
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
// list_bookings' plain day choice, as days from today.
const DAY_OFFSETS = { yesterday: -1, today: 0, tomorrow: 1 } as const
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

// At most maxHoursRows rows of weekday 0-6 with open and close HH:mm, or null.
function validHoursRows(value: unknown): HoursInput[] | null {
  if (!Array.isArray(value) || value.length > BOOKING_RULES.maxHoursRows) {
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
      return { error: t.errors.nameInvalid(BOOKING_RULES.maxServiceName) }
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
      return {
        error: t.errors.descriptionInvalid(BOOKING_RULES.maxServiceDescription),
      }
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
  // Shared checks for set_service_team: describe and execute both use this.
  const checkServiceTeamArgs = async (
    args: unknown
  ): Promise<
    | { service: { id: string; name: string }; memberIds: string[]; team: { id: string; name: string }[] }
    | { error: string }
  > => {
    const a = asRecord(args)
    if (!a || typeof a.serviceId !== "string" || a.serviceId === "") {
      return { error: t.errors.serviceIdRequired }
    }
    if (
      !Array.isArray(a.teamMemberIds) ||
      !a.teamMemberIds.every((id) => typeof id === "string")
    ) {
      return { error: t.errors.memberUnknown }
    }
    const { services, team } = await getOwnerBusiness(businessId)
    const service = services.find((s) => s.id === a.serviceId)
    if (!service) {
      return { error: t.errors.serviceUnknown }
    }
    const memberIds = [...new Set(a.teamMemberIds as string[])]
    if (memberIds.some((id) => !team.some((m) => m.id === id))) {
      return { error: t.errors.memberUnknown }
    }
    return { service, memberIds, team }
  }
  // Shared checks for set_member_services: describe and execute both use this.
  const checkMemberServicesArgs = async (
    args: unknown
  ): Promise<
    | { member: { id: string; name: string }; serviceIds: string[]; services: { id: string; name: string }[] }
    | { error: string }
  > => {
    const a = asRecord(args)
    if (!a || typeof a.teamMemberId !== "string" || a.teamMemberId === "") {
      return { error: t.errors.memberIdRequired }
    }
    if (
      !Array.isArray(a.serviceIds) ||
      !a.serviceIds.every((id) => typeof id === "string")
    ) {
      return { error: t.errors.serviceUnknown }
    }
    const { services, team } = await getOwnerBusiness(businessId)
    const member = team.find((m) => m.id === a.teamMemberId)
    if (!member) {
      return { error: t.errors.memberUnknown }
    }
    const serviceIds = [...new Set(a.serviceIds as string[])]
    if (serviceIds.some((id) => !services.some((s) => s.id === id))) {
      return { error: t.errors.serviceUnknown }
    }
    return { member, serviceIds, services }
  }
  interface CheckedAddonOption {
    id: string | null
    name: string
    description: string | null
    priceMinor: number | null
    durationMinutes: number
  }
  const checkAddonOption = (
    value: unknown,
    allowId: boolean
  ): CheckedAddonOption | null => {
    const o = asRecord(value)
    if (!o) {
      return null
    }
    const id =
      o.id === undefined || o.id === null
        ? null
        : typeof o.id === "string" && o.id !== "" && allowId
          ? o.id
          : null
    if (o.id !== undefined && o.id !== null && id === null) {
      return null
    }
    const name = validName(o.name, BOOKING_RULES.maxAddonName)
    if (!name) {
      return null
    }
    const description =
      o.description === undefined || o.description === null
        ? null
        : typeof o.description !== "string"
          ? "invalid"
          : o.description.trim() === ""
            ? null
            : o.description.trim()
    if (
      description === "invalid" ||
      (description !== null &&
        description.length > BOOKING_RULES.maxAddonDescription)
    ) {
      return null
    }
    const priceMinor = validPriceMinor(o.priceMinor)
    if (priceMinor === "invalid") {
      return null
    }
    if (
      typeof o.durationMinutes !== "number" ||
      !(BOOKING_RULES.addonMinutes as readonly number[]).includes(
        o.durationMinutes
      )
    ) {
      return null
    }
    return { id, name, description, priceMinor, durationMinutes: o.durationMinutes }
  }
  const checkAddonOptions = (
    value: unknown,
    allowId: boolean
  ): CheckedAddonOption[] | null => {
    if (
      !Array.isArray(value) ||
      value.length < 1 ||
      value.length > BOOKING_RULES.maxAddonOptions
    ) {
      return null
    }
    const options: CheckedAddonOption[] = []
    for (const item of value) {
      const option = checkAddonOption(item, allowId)
      if (!option) {
        return null
      }
      options.push(option)
    }
    return options
  }
  // Shared checks for the extras tools: validate one add-on group input.
  // With current null every field is required (create); otherwise only the
  // given fields change (update).
  const checkAddonGroupArgs = async (
    args: unknown,
    current: {
      name: string
      prompt: string
      minSelect: number
      maxSelect: number | null
      serviceIds: string[]
      options: CheckedAddonOption[]
    } | null
  ): Promise<
    | {
        input: {
          name: string
          prompt: string
          minSelect: number
          maxSelect: number | null
          serviceIds: string[]
          options: CheckedAddonOption[]
        }
        services: { id: string; name: string }[]
      }
    | { error: string }
  > => {
    const a = asRecord(args)
    if (!a) {
      return { error: t.errors.optionsInvalid(BOOKING_RULES.maxAddonOptions) }
    }
    const name =
      a.name === undefined && current
        ? current.name
        : validName(a.name, BOOKING_RULES.maxAddonName)
    if (!name) {
      return { error: t.errors.nameInvalid(BOOKING_RULES.maxAddonName) }
    }
    const prompt =
      a.prompt === undefined && current
        ? current.prompt
        : validName(a.prompt, BOOKING_RULES.maxAddonPrompt)
    if (!prompt) {
      return {
        error: t.errors.promptInvalid(BOOKING_RULES.maxAddonPrompt),
      }
    }
    const rawOptions =
      a.options === undefined
        ? (current?.options.map((o) => ({ ...o })) ?? null)
        : checkAddonOptions(a.options, current !== null)
    if (!rawOptions) {
      return { error: t.errors.optionsInvalid(BOOKING_RULES.maxAddonOptions) }
    }
    if (current) {
      const currentIds = new Set(current.options.map((o) => o.id))
      if (
        rawOptions.some((o) => o.id !== null && !currentIds.has(o.id))
      ) {
        return { error: t.errors.optionsInvalid(BOOKING_RULES.maxAddonOptions) }
      }
    }
    const minSelect =
      a.minSelect === undefined && current
        ? current.minSelect
        : a.minSelect
    const maxSelect =
      a.maxSelect === undefined ? (current?.maxSelect ?? null) : a.maxSelect
    if (
      !Number.isInteger(minSelect) ||
      (minSelect as number) < 0 ||
      (minSelect as number) > rawOptions.length ||
      (maxSelect !== null &&
        (!Number.isInteger(maxSelect) ||
          (maxSelect as number) <
            Math.max(1, minSelect as number) ||
          (maxSelect as number) > rawOptions.length))
    ) {
      return { error: t.errors.selectsInvalid }
    }
    const { services } = await getOwnerBusiness(businessId)
    const rawServiceIds =
      a.serviceIds === undefined && current ? current.serviceIds : a.serviceIds
    if (
      !Array.isArray(rawServiceIds) ||
      !rawServiceIds.every((id) => typeof id === "string")
    ) {
      return { error: t.errors.serviceUnknown }
    }
    const serviceIds = [...new Set(rawServiceIds as string[])]
    if (serviceIds.some((id) => !services.some((s) => s.id === id))) {
      return { error: t.errors.serviceUnknown }
    }
    return {
      input: {
        name,
        prompt,
        minSelect: minSelect as number,
        maxSelect: maxSelect as number | null,
        serviceIds,
        options: rawOptions,
      },
      services,
    }
  }
  // Shared checks for update_business_details: overlay the given fields on
  // the current business. Describe and execute both use this.
  const checkBusinessDetailsArgs = async (
    args: unknown
  ): Promise<
    | {
        current: {
          name: string
          address: string | null
          description: string | null
          phone: string | null
          website: string | null
          seats: number
        }
        input: {
          name: string
          address: string | null
          description: string | null
          phone: string | null
          website: string | null
          seats: number
        }
      }
    | { error: string }
  > => {
    const a = asRecord(args)
    if (!a) {
      return { error: t.errors.nothingToChange }
    }
    const { business } = await getOwnerBusiness(businessId)
    const current = {
      name: business.name,
      address: business.address,
      description: business.description,
      phone: business.phone,
      website: business.website,
      seats: business.seats,
    }
    const name =
      a.name === undefined
        ? current.name
        : validName(a.name, BOOKING_RULES.maxBusinessName)
    if (!name) {
      return {
        error: t.errors.businessNameInvalid(BOOKING_RULES.maxBusinessName),
      }
    }
    const textField = (
      value: unknown,
      max: number
    ): string | null | "invalid" | "keep" => {
      if (value === undefined) {
        return "keep"
      }
      if (value === null) {
        return null
      }
      if (typeof value !== "string") {
        return "invalid"
      }
      const trimmed = value.trim()
      if (trimmed === "") {
        return null
      }
      return trimmed.length <= max ? trimmed : "invalid"
    }
    const address = textField(a.address, BOOKING_RULES.maxBusinessAddress)
    if (address === "invalid") {
      return { error: t.errors.addressInvalid(BOOKING_RULES.maxBusinessAddress) }
    }
    const description = textField(
      a.description,
      BOOKING_RULES.maxBusinessDescription
    )
    if (description === "invalid") {
      return { error: t.errors.aboutInvalid(BOOKING_RULES.maxBusinessDescription) }
    }
    const phone =
      a.phone === undefined
        ? "keep"
        : a.phone === null
          ? null
          : typeof a.phone === "string" && a.phone.trim() === ""
            ? null
            : typeof a.phone === "string" && PHONE_PATTERN.test(a.phone.trim())
              ? a.phone.trim()
              : "invalid"
    if (phone === "invalid") {
      return { error: t.errors.phoneInvalid }
    }
    const website =
      a.website === undefined
        ? "keep"
        : a.website === null
          ? null
          : (() => {
              if (typeof a.website !== "string") {
                return "invalid" as const
              }
              const trimmed = a.website.trim()
              if (trimmed === "") {
                return null
              }
              try {
                const url = new URL(trimmed)
                return url.protocol === "http:" || url.protocol === "https:"
                  ? trimmed
                  : ("invalid" as const)
              } catch {
                return "invalid" as const
              }
            })()
    if (website === "invalid") {
      return { error: t.errors.websiteInvalid }
    }
    const seats = a.seats === undefined ? current.seats : a.seats
    if (
      typeof seats !== "number" ||
      !Number.isInteger(seats) ||
      seats < 1 ||
      seats > BOOKING_RULES.maxSeats
    ) {
      return { error: t.errors.seatsInvalid(BOOKING_RULES.maxSeats) }
    }
    return {
      current,
      input: {
        name,
        address: address === "keep" ? current.address : address,
        description: description === "keep" ? current.description : description,
        phone: phone === "keep" ? current.phone : phone,
        website: website === "keep" ? current.website : website,
        seats,
      },
    }
  }
  return [
    {
      definition: {
        name: "business_overview",
        description:
          "Name, address, phone, hours, booking counts, about, website, category, seats, bookingPath, photoCount and Spanish status.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t.steps.overview,
      run: async () => {
        const [{ business, hours }, counts, photos, spanish] =
          await Promise.all([
            getOwnerBusiness(businessId),
            getBookingCounts(businessId),
            getBusinessPhotos(businessId),
            getTranslationStatus(businessId),
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
          about: business.description,
          website: business.website,
          category: business.category,
          seats: business.seats,
          bookingPath: `/b/${business.slug}`,
          photoCount: photos.length,
          spanish: {
            enabled: spanish.enabled,
            total: spanish.total,
            upToDate: spanish.upToDate,
          },
        }
      },
    },
    {
      definition: {
        name: "list_services",
        description:
          "All services with duration, price, description, photo yes/no, team member ids and add-on group ids.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t.steps.services,
      run: async () => {
        const [{ services }, teams, groups] = await Promise.all([
          getOwnerBusiness(businessId),
          getServiceTeams(businessId),
          getAddonGroups(businessId),
        ])
        const rows = services.map((s) => ({
          id: s.id,
          name: s.name,
          durationMinutes: s.durationMinutes,
          priceMinor: s.priceMinor,
          description: s.description,
          hasPhoto: s.photoUrl !== null,
          teamMemberIds: teams[s.id] ?? [],
          addonGroupIds: groups
            .filter((g) => g.serviceIds.includes(s.id))
            .map((g) => g.id),
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
        name: "list_addons",
        description:
          "All add-on groups with their options, each with price and length.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t.steps.addons,
      run: async () => {
        const groups = await getAddonGroups(businessId)
        const rows = groups.map((g) => ({
          id: g.id,
          name: g.name,
          prompt: g.prompt,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          serviceIds: g.serviceIds,
          options: g.options.map((o) => ({
            id: o.id,
            name: o.name,
            description: o.description,
            priceMinor: o.priceMinor,
            durationMinutes: o.durationMinutes,
          })),
        }))
        const capped = rows.slice(0, 50)
        return {
          groups: capped,
          total: rows.length,
          truncated: rows.length > capped.length,
        }
      },
    },
    {
      definition: {
        name: "list_team",
        description: "All team members with photo yes/no and service ids.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t.steps.team,
      run: async () => {
        const [{ team }, teams] = await Promise.all([
          getOwnerBusiness(businessId),
          getServiceTeams(businessId),
        ])
        const serviceIdsByMember = new Map<string, string[]>()
        for (const [serviceId, memberIds] of Object.entries(teams)) {
          for (const memberId of memberIds) {
            const ids = serviceIdsByMember.get(memberId) ?? []
            ids.push(serviceId)
            serviceIdsByMember.set(memberId, ids)
          }
        }
        const rows = team.map((m) => ({
          id: m.id,
          name: m.name,
          hasPhoto: m.photoUrl !== null,
          serviceIds: serviceIdsByMember.get(m.id) ?? [],
        }))
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
          "Bookings, each with when (past / now / upcoming), team member, length, price, source, note and add-ons. For yesterday, today or tomorrow, pass only day: every booking that day, past and upcoming (count them all for 'how many today'). For other days, from/to: every booking on those days; adding range keeps only that side of now. With none of these: upcoming (soonest first) or past (most recent first). Source caps: next 200 upcoming, last 100 past.",
        // `day` is worked out here in the business timezone, so the model
        // never has to compute a date or pick a side of now for a plain day
        // ("Don't make the model fill arguments you already know", OpenAI
        // function calling guide:
        // https://developers.openai.com/api/docs/guides/function-calling).
        parameters: schema({
          day: {
            type: "string",
            enum: Object.keys(DAY_OFFSETS),
            description: "A whole day in the business timezone",
          },
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
        const a = { ...((args ?? {}) as Record<string, unknown>) }
        if (a.day !== undefined) {
          if (!Object.hasOwn(DAY_OFFSETS, a.day as string)) {
            return bad(t.errors.dayChoiceInvalid)
          }
          if (
            a.from !== undefined ||
            a.to !== undefined ||
            a.range !== undefined
          ) {
            return bad(t.errors.dayAlone)
          }
          const { business } = await getOwnerBusiness(businessId)
          a.from = a.to = addDaysStr(
            zonedToday(Date.now(), business.timezone),
            DAY_OFFSETS[a.day as keyof typeof DAY_OFFSETS]
          )
        }
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
        // One now per call for every comparison below.
        const now = new Date().toISOString()
        const hasDayFilter = a.from !== undefined || a.to !== undefined
        // No day filter: exactly today's single source. With a day
        // filter, range is read raw: no range means both sides of now
        // (an earlier-today booking is "past" but still belongs to
        // today); a given range keeps only that side, using the app's
        // own definition (upcoming = endAt >= now, past = endAt < now).
        // Never read the defaulted range variable here: it cannot tell
        // "range not given" from "range: upcoming".
        const rows = !hasDayFilter
          ? await getBookings(businessId, range)
          : a.range === undefined
            ? [
                ...(await getBookings(businessId, "upcoming")),
                ...(await getBookings(businessId, "past")),
              ]
            : await getBookings(businessId, range)
        const seen = new Set<string>()
        const filtered = rows.filter((b) => {
          if (seen.has(b.id)) {
            return false
          }
          seen.add(b.id)
          return (
            (a.from === undefined || b.date >= (a.from as string)) &&
            (a.to === undefined || b.date <= (a.to as string)) &&
            (a.status === undefined || b.status === a.status) &&
            (!hasDayFilter ||
              a.range === undefined ||
              (range === "upcoming" ? b.endAt >= now : b.endAt < now))
          )
        })
        if (hasDayFilter) {
          filtered.sort((x, y) =>
            x.date < y.date
              ? -1
              : x.date > y.date
                ? 1
                : x.time < y.time
                  ? -1
                  : x.time > y.time
                    ? 1
                    : 0
          )
        }
        const capped = filtered.slice(0, 25).map((b) => ({
          id: b.id,
          date: b.date,
          time: b.time,
          endTime: b.endTime,
          when:
            b.endAt < now
              ? ("past" as const)
              : b.startAt > now
                ? ("upcoming" as const)
                : ("now" as const),
          service: b.serviceName,
          customer: b.customerName,
          phone: b.customerPhone,
          status: b.status,
          teamMember: b.teamMemberName,
          durationMinutes: b.durationMinutes,
          priceMinor: b.priceMinor,
          currency: b.currency,
          source: b.source,
          note: b.note,
          addons: b.addons.map((a) => ({
            name: a.name,
            priceMinor: a.priceMinor,
            durationMinutes: a.durationMinutes,
          })),
        }))
        return {
          // The date a plain day stood for, so the answer can name it.
          ...(a.day !== undefined ? { date: a.from } : {}),
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
          query.length > ASSISTANT_RULES.maxCustomerQuery
        ) {
          return bad(t.errors.queryInvalid(ASSISTANT_RULES.maxCustomerQuery))
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
              firstBooking: c.firstBooking,
              spentMinor: c.spentMinor,
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
        name: "booking_stats",
        description:
          "Counts and money for every booking from from through to (both YYYY-MM-DD, both days included): totals by status, earned and expected money, no-show rate, busiest weekdays, hours, services and team members.",
        parameters: schema(
          {
            from: {
              type: "string",
              description: "First day, YYYY-MM-DD in the business timezone",
            },
            to: {
              type: "string",
              description: "Last day, YYYY-MM-DD in the business timezone",
            },
          },
          ["from", "to"]
        ),
        needsConfirm: false,
      },
      label: t.steps.stats,
      run: async (args: unknown) => {
        const a = asRecord(args) ?? {}
        if (typeof a.from !== "string" || !isRealDate(a.from)) {
          return bad(t.errors.dayInvalid("from"))
        }
        if (typeof a.to !== "string" || !isRealDate(a.to) || a.to < a.from) {
          return bad(t.errors.toInvalid)
        }
        if (
          daysInRange(a.from, a.to) > ASSISTANT_RULES.maxStatsRangeDays
        ) {
          return bad(
            t.errors.rangeTooLong(ASSISTANT_RULES.maxStatsRangeDays)
          )
        }
        const [rows, { business }] = await Promise.all([
          getBookingsBetween(businessId, a.from, a.to),
          getOwnerBusiness(businessId),
        ])
        const now = new Date().toISOString()
        return { ...bookingStats(rows, now, business.currency), from: a.from, to: a.to }
      },
    },
    {
      definition: {
        name: "list_customers",
        description:
          "All customers with visits, no-shows, first and last visit, next booking and money spent. Sort newest first; newSince keeps only customers whose first booking is on or after that day (YYYY-MM-DD).",
        parameters: schema({
          sort: {
            type: "string",
            enum: ["bookings", "spent", "lastVisit", "firstBooking"],
          },
          newSince: {
            type: "string",
            description: "YYYY-MM-DD in the business timezone",
          },
        }),
        needsConfirm: false,
      },
      label: t.steps.customers,
      run: async (args: unknown) => {
        const a = asRecord(args) ?? {}
        const sorts = ["bookings", "spent", "lastVisit", "firstBooking"] as const
        const sort =
          a.sort === undefined ? ("lastVisit" as const) : a.sort
        if (!sorts.includes(sort as (typeof sorts)[number])) {
          return bad(t.errors.sortInvalid)
        }
        if (
          a.newSince !== undefined &&
          (typeof a.newSince !== "string" || !isRealDate(a.newSince))
        ) {
          return bad(t.errors.dayInvalid("newSince"))
        }
        const newSince =
          typeof a.newSince === "string" ? a.newSince : undefined
        const all = await getCustomers(businessId)
        const filtered =
          newSince === undefined
            ? all
            : all.filter(
                (c) =>
                  c.firstBooking !== null && c.firstBooking >= newSince
              )
        const value = (
          c: (typeof filtered)[number]
        ): number | string | null => {
          switch (sort) {
            case "bookings":
              return c.bookings
            case "spent":
              return c.spentMinor
            case "firstBooking":
              return c.firstBooking
            default:
              return c.lastVisit
          }
        }
        const sorted = [...filtered].sort((x, y) => {
          const vx = value(x)
          const vy = value(y)
          if (vx === null && vy === null) {
            return 0
          }
          if (vx === null) {
            return 1
          }
          if (vy === null) {
            return -1
          }
          return vx < vy ? 1 : vx > vy ? -1 : 0
        })
        const capped = sorted.slice(0, 25).map((c) => ({
          name: c.name,
          phone: c.phone,
          bookings: c.bookings,
          completed: c.completed,
          noShows: c.noShows,
          cancelled: c.cancelled,
          firstBooking: c.firstBooking,
          lastVisit: c.lastVisit,
          nextBooking: c.nextBooking,
          spentMinor: c.spentMinor,
          currency: c.currency,
        }))
        return {
          customers: capped,
          total: filtered.length,
          truncated: filtered.length > capped.length,
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
              description: `Service name, 1-${BOOKING_RULES.maxServiceName} characters`,
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
              description: `Optional, max ${BOOKING_RULES.maxServiceDescription} characters`,
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
          return bad(t.errors.nameInvalid(BOOKING_RULES.maxServiceName))
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
          return bad(
            t.errors.descriptionInvalid(BOOKING_RULES.maxServiceDescription)
          )
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
          name: {
            type: "string",
            description: `New name, 1-${BOOKING_RULES.maxServiceName} characters`,
          },
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
            description: `New description, max ${BOOKING_RULES.maxServiceDescription} characters`,
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
            return { error: t.errors.nothingToChange }
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
            name: {
              type: "string",
              description: `New name, 1-${BOOKING_RULES.maxTeamName} characters`,
            },
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
        const name = validName(a.name, BOOKING_RULES.maxTeamName)
        if (!name) {
          return bad(t.errors.nameInvalid(BOOKING_RULES.maxTeamName))
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
        name: "create_team_member",
        description: `Add a team member. Name is 1-${BOOKING_RULES.maxTeamName} characters.`,
        parameters: schema({ name: { type: "string" } }, ["name"]),
        needsConfirm: false,
      },
      label: t.steps.createMember,
      run: async (args: unknown) => {
        const a = asRecord(args)
        const name = a && validName(a.name, BOOKING_RULES.maxTeamName)
        if (!name) {
          return bad(t.errors.nameInvalid(BOOKING_RULES.maxTeamName))
        }
        const result = await createTeamMember(businessId, name)
        if (!result.ok) {
          await audit(
            "create_team_member",
            `create "${name}" failed: ${result.error}`,
            "failed"
          )
          return { error: result.error }
        }
        await audit("create_team_member", `created "${name}"`, "ok")
        return { created: { id: result.id, name } }
      },
    },
    {
      definition: {
        name: "set_service_team",
        description:
          "Choose which team members do a service. Use the id from list_services and ids from list_team; an empty list means anyone can do it. Needs the owner's tap.",
        parameters: schema(
          {
            serviceId: { type: "string", description: "Id from list_services" },
            teamMemberIds: {
              type: "array",
              description: "Ids from list_team, empty for anyone",
              items: { type: "string" },
            },
          },
          ["serviceId", "teamMemberIds"]
        ),
        needsConfirm: true,
        resultKind: "services",
      },
      label: t.steps.serviceTeam,
      run: async () => ({ error: t.tapFirst.serviceTeam }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkServiceTeamArgs(args)
          if ("error" in checked) {
            return checked
          }
          const names = checked.memberIds.map(
            (id) => checked.team.find((m) => m.id === id)!.name
          )
          return {
            title: t.cards.serviceTeam,
            action: t.actions.serviceTeam,
            summary: `${checked.service.name} · ${names.length > 0 ? names.join(", ") : t.serviceTeam.anyone}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkServiceTeamArgs(args)
          if ("error" in checked) {
            if (
              checked.error === t.errors.serviceUnknown ||
              checked.error === t.errors.serviceIdRequired
            ) {
              return { ok: false, doneText: t.serviceTeam.unknown }
            }
            return {
              ok: false,
              doneText: t.serviceTeam.failed(checked.error),
            }
          }
          const result = await setServiceTeam(
            businessId,
            checked.service.id,
            checked.memberIds
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText: t.serviceTeam.failed(result.error),
            }
          }
          return { ok: true, doneText: t.serviceTeam.done }
        },
      },
    },
    {
      definition: {
        name: "set_member_services",
        description:
          "Choose which services a team member does. Use the id from list_team and ids from list_services; an empty list means no services. Needs the owner's tap.",
        parameters: schema(
          {
            teamMemberId: { type: "string", description: "Id from list_team" },
            serviceIds: {
              type: "array",
              description: "Ids from list_services, empty for none",
              items: { type: "string" },
            },
          },
          ["teamMemberId", "serviceIds"]
        ),
        needsConfirm: true,
        resultKind: "team",
      },
      label: t.steps.memberServices,
      run: async () => ({ error: t.tapFirst.memberServices }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkMemberServicesArgs(args)
          if ("error" in checked) {
            return checked
          }
          const names = checked.serviceIds.map(
            (id) => checked.services.find((s) => s.id === id)!.name
          )
          return {
            title: t.cards.memberServices,
            action: t.actions.memberServices,
            summary: `${checked.member.name} · ${names.length > 0 ? names.join(", ") : t.memberServices.none}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkMemberServicesArgs(args)
          if ("error" in checked) {
            if (
              checked.error === t.errors.memberUnknown ||
              checked.error === t.errors.memberIdRequired
            ) {
              return { ok: false, doneText: t.memberServices.unknown }
            }
            return {
              ok: false,
              doneText: t.memberServices.failed(checked.error),
            }
          }
          const result = await setMemberServices(
            businessId,
            checked.member.id,
            checked.serviceIds
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText: t.memberServices.failed(result.error),
            }
          }
          return { ok: true, doneText: t.memberServices.done }
        },
      },
    },
    {
      definition: {
        name: "create_addon_group",
        description: `Create an extras group with its options. At most ${BOOKING_RULES.maxAddonGroups} groups per business, each with 1-${BOOKING_RULES.maxAddonOptions} options. Names fit ${BOOKING_RULES.maxAddonName} characters, descriptions ${BOOKING_RULES.maxAddonDescription}, prompt ${BOOKING_RULES.maxAddonPrompt}. Each option needs a duration in minutes, one of ${(BOOKING_RULES.addonMinutes as readonly number[]).join(", ")}, and a price in minor units or null. Needs the owner's tap.`,
        parameters: schema(
          {
            name: { type: "string" },
            prompt: { type: "string" },
            minSelect: { type: "integer" },
            maxSelect: { type: ["integer", "null"] },
            serviceIds: {
              type: "array",
              description: "Ids from list_services",
              items: { type: "string" },
            },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: ["string", "null"] },
                  priceMinor: { type: ["integer", "null"] },
                  durationMinutes: { type: "integer" },
                },
                required: ["name", "priceMinor", "durationMinutes"],
                additionalProperties: false,
              },
            },
          },
          ["name", "prompt", "minSelect", "serviceIds", "options"]
        ),
        needsConfirm: true,
        resultKind: "services",
      },
      label: t.steps.createAddon,
      run: async () => ({ error: t.tapFirst.createAddon }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkAddonGroupArgs(args, null)
          if ("error" in checked) {
            return checked
          }
          return {
            title: t.cards.createAddon,
            action: t.actions.createAddon,
            summary: `${checked.input.name} · ${checked.input.prompt} · ${checked.input.options.map((o) => o.name).join(", ")}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkAddonGroupArgs(args, null)
          if ("error" in checked) {
            return {
              ok: false,
              doneText: t.createAddon.failed(checked.error),
            }
          }
          const result = await createAddonGroup(businessId, {
            ...checked.input,
            options: checked.input.options.map((o) => ({ ...o, id: null })),
          })
          if (!result.ok) {
            return {
              ok: false,
              doneText: t.createAddon.failed(result.error),
            }
          }
          return { ok: true, doneText: t.createAddon.done }
        },
      },
    },
    {
      definition: {
        name: "update_addon_group",
        description:
          "Change an extras group. Use the id from list_addons; only the given fields change. When options are given, pass the existing option ids from list_addons to keep an option, id null for a new one, and leave out an id to remove that option. Needs the owner's tap.",
        parameters: schema({
          groupId: { type: "string", description: "Id from list_addons" },
          name: { type: "string" },
          prompt: { type: "string" },
          minSelect: { type: "integer" },
          maxSelect: { type: ["integer", "null"] },
          serviceIds: {
            type: "array",
            description: "Ids from list_services",
            items: { type: "string" },
          },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: ["string", "null"] },
                name: { type: "string" },
                description: { type: ["string", "null"] },
                priceMinor: { type: ["integer", "null"] },
                durationMinutes: { type: "integer" },
              },
              required: ["name", "priceMinor", "durationMinutes"],
              additionalProperties: false,
            },
          },
        }),
        needsConfirm: true,
        resultKind: "services",
      },
      label: t.steps.updateAddon,
      run: async () => ({ error: t.tapFirst.updateAddon }),
      confirm: {
        describe: async (args: unknown) => {
          const a = asRecord(args)
          if (!a || typeof a.groupId !== "string" || a.groupId === "") {
            return { error: t.errors.groupIdRequired }
          }
          const groups = await getAddonGroups(businessId)
          const current = groups.find((g) => g.id === a.groupId)
          if (!current) {
            return { error: t.errors.groupUnknown }
          }
          const checked = await checkAddonGroupArgs(args, current)
          if ("error" in checked) {
            return checked
          }
          const parts: string[] = []
          if (checked.input.name !== current.name) {
            parts.push(`${current.name} → ${checked.input.name}`)
          }
          if (checked.input.prompt !== current.prompt) {
            parts.push(`${current.prompt} → ${checked.input.prompt}`)
          }
          if (checked.input.minSelect !== current.minSelect) {
            parts.push(`${current.minSelect} → ${checked.input.minSelect}`)
          }
          if (checked.input.maxSelect !== current.maxSelect) {
            parts.push(
              `${current.maxSelect ?? ""} → ${checked.input.maxSelect ?? ""}`
            )
          }
          const serviceName = (id: string): string =>
            checked.services.find((s) => s.id === id)?.name ?? id
          if (
            checked.input.serviceIds.join(",") !== current.serviceIds.join(",")
          ) {
            parts.push(
              `${current.serviceIds.map(serviceName).join(", ")} → ${checked.input.serviceIds.map(serviceName).join(", ")}`
            )
          }
          const currentIds = new Set(
            current.options.map((o) => o.id)
          )
          const nextIds = new Set(
            checked.input.options.map((o) => o.id)
          )
          for (const o of checked.input.options) {
            if (o.id === null || !currentIds.has(o.id)) {
              parts.push(`+ ${o.name}`)
            }
          }
          for (const o of current.options) {
            if (!nextIds.has(o.id)) {
              parts.push(`- ${o.name}`)
            }
          }
          if (parts.length === 0) {
            return { error: t.errors.nothingToChange }
          }
          return {
            title: t.cards.updateAddon,
            action: t.actions.updateAddon,
            summary: `${current.name} · ${parts.join(" · ")}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const a = asRecord(args)
          if (!a || typeof a.groupId !== "string" || a.groupId === "") {
            return { ok: false, doneText: t.updateAddon.unknown }
          }
          const groups = await getAddonGroups(businessId)
          const current = groups.find((g) => g.id === a.groupId)
          if (!current) {
            return { ok: false, doneText: t.updateAddon.unknown }
          }
          const checked = await checkAddonGroupArgs(args, current)
          if ("error" in checked) {
            return {
              ok: false,
              doneText: t.updateAddon.failed(checked.error),
            }
          }
          const result = await updateAddonGroup(
            businessId,
            current.id,
            checked.input
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText: t.updateAddon.failed(result.error),
            }
          }
          return { ok: true, doneText: t.updateAddon.done }
        },
      },
    },
    {
      definition: {
        name: "delete_addon_group",
        description:
          "Delete an extras group with all its options. Use the id from list_addons. Needs the owner's tap.",
        parameters: schema(
          {
            groupId: { type: "string", description: "Id from list_addons" },
          },
          ["groupId"]
        ),
        needsConfirm: true,
        resultKind: "services",
      },
      label: t.steps.deleteAddon,
      run: async () => ({ error: t.tapFirst.deleteAddon }),
      confirm: {
        describe: async (args: unknown) => {
          const a = asRecord(args)
          if (!a || typeof a.groupId !== "string" || a.groupId === "") {
            return { error: t.errors.groupIdRequired }
          }
          const groups = await getAddonGroups(businessId)
          const group = groups.find((g) => g.id === a.groupId)
          if (!group) {
            return { error: t.errors.groupUnknown }
          }
          return {
            title: t.cards.deleteAddon,
            action: t.actions.deleteAddon,
            summary: `${group.name} · ${group.options.map((o) => o.name).join(", ")}`,
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const a = asRecord(args)
          const groupId = a?.groupId
          if (typeof groupId !== "string" || groupId === "") {
            return { ok: false, doneText: t.deleteAddon.unknown }
          }
          const result = await deleteAddonGroup(businessId, groupId)
          if (!result.ok) {
            return {
              ok: false,
              doneText: t.deleteAddon.failed(result.error),
            }
          }
          return { ok: true, doneText: t.deleteAddon.done }
        },
      },
    },
    {
      definition: {
        name: "update_business_details",
        description:
          "Change the business details: name, address, about text, phone, website or seats. Only the given fields change. Needs the owner's tap.",
        parameters: schema({
          name: { type: "string" },
          address: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
          website: { type: ["string", "null"] },
          seats: { type: "integer" },
        }),
        needsConfirm: true,
        resultKind: "settings",
      },
      label: t.steps.updateBusiness,
      run: async () => ({ error: t.tapFirst.updateBusiness }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkBusinessDetailsArgs(args)
          if ("error" in checked) {
            return checked
          }
          const short = (value: string | null): string =>
            value === null
              ? ""
              : value.length > 60
                ? value.slice(0, 60)
                : value
          const fields = t.updateBusiness.fields
          const rows: [string, string | null, string | null][] = [
            [fields.name, checked.current.name, checked.input.name],
            [fields.address, checked.current.address, checked.input.address],
            [
              fields.about,
              checked.current.description,
              checked.input.description,
            ],
            [fields.phone, checked.current.phone, checked.input.phone],
            [fields.website, checked.current.website, checked.input.website],
            [
              fields.seats,
              String(checked.current.seats),
              String(checked.input.seats),
            ],
          ]
          const parts = rows
            .filter(([, old, next]) => old !== next)
            .map(
              ([label, old, next]) =>
                `${label} · ${short(old)} → ${short(next)}`
            )
          if (parts.length === 0) {
            return { error: t.errors.nothingToChange }
          }
          return {
            title: t.cards.updateBusiness,
            action: t.actions.updateBusiness,
            summary: parts.join(" · "),
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkBusinessDetailsArgs(args)
          if ("error" in checked) {
            return {
              ok: false,
              doneText: t.updateBusiness.failed(checked.error),
            }
          }
          const result = await updateBusinessDetails(
            businessId,
            checked.input
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText: t.updateBusiness.failed(result.error),
            }
          }
          return { ok: true, doneText: t.updateBusiness.done }
        },
      },
    },
    {
      definition: {
        name: "set_hours",
        description: `Replace the opening hours. At most ${BOOKING_RULES.maxHoursRows} rows; each row is a weekday (0 Sunday to 6 Saturday) with open and close HH:mm. Needs the owner's tap.`,
        parameters: schema(
          {
            rows: {
              type: "array",
              description: `New weekly hours, at most ${BOOKING_RULES.maxHoursRows} rows`,
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
            return { error: t.errors.rowsInvalid(BOOKING_RULES.maxHoursRows) }
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
        description: `Free start times per day for a service. Use ids from list_services and list_team. Default is today plus 6 days. At most ${ASSISTANT_RULES.maxFreeTimesDays} days at once.`,
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
        if (daysInRange(from, to) > ASSISTANT_RULES.maxFreeTimesDays) {
          return bad(t.errors.spanInvalid(ASSISTANT_RULES.maxFreeTimesDays))
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
        const capped = inRange.slice(0, ASSISTANT_RULES.maxFreeTimesDays)
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
