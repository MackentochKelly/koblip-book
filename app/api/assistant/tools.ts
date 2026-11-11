import "server-only"

import { getTranslations } from "next-intl/server"

import type {
  AssistantTool,
  OwnerWords,
  ResultKind,
  ServerWords,
} from "@/features/assistant/types"
import { DEFAULT_LOCALES, type PageLanguage } from "@/lib/page-language"
import {
  cancelBooking,
  createService,
  createTeamMember,
  deleteService,
  deleteTeamMember,
  renameTeamMember,
  reorderServices,
  reorderTeam,
  saveHours,
  suggestServices,
  updateBusinessDetails,
  updateService,
} from "@/features/dashboard/api/actions"
import {
  createAddonGroup,
  deleteAddonGroup,
  reorderAddonGroups,
  suggestAddonGroups,
  updateAddonGroup,
} from "@/features/dashboard/api/addon-actions"
import { setAutomationOn } from "@/features/dashboard/api/automation-actions"
import { automationsFor } from "@/features/dashboard/api/automation-queries"
import {
  createServiceCategory,
  deleteServiceCategory,
  reorderServiceCategories,
  updateServiceCategory,
} from "@/features/dashboard/api/category-actions"
import { addCustomer } from "@/features/dashboard/api/customer-actions"
import { improveDetails } from "@/features/dashboard/api/improve-details"
import { saveTeamMemberWithHours } from "@/features/dashboard/api/member-hours"
import { bookWordsFor } from "@/features/dashboard/api/message-words"
import {
  saveMessageWording,
  saveNotificationSettings,
  setEmailOn,
  setMessageOn,
} from "@/features/dashboard/api/notification-actions"
import { emailActivity } from "@/lib/email-activity"
import { EMAIL_ACTIVITY_STATES } from "@/lib/email-activity-filter"
import {
  BOOKING_EMAILS,
  CUSTOMER_EMAILS,
  isBookingEmail,
  type BookingEmail,
} from "@/lib/email-rules"
import {
  notificationMessagesFor,
  notificationSettingsFor,
} from "@/features/dashboard/api/notifications"
import {
  deleteBusinessPhoto,
  reorderBusinessPhotos,
} from "@/features/dashboard/api/photo-actions"
import {
  removePolicy,
  removePolicyPoint,
  saveOwnPolicy,
  savePolicy,
  savePolicyPoint,
} from "@/features/dashboard/api/policy-actions"
import { getPolicies } from "@/features/dashboard/api/policy-queries"
import {
  removeTeamAccess,
  sendTeamInvite,
} from "@/features/dashboard/api/team-access-actions"
import {
  setMemberServices,
  setServiceTeam,
} from "@/features/dashboard/api/team-services"
import { activateTheme } from "@/features/dashboard/api/theme-actions"
import { setBookingStatus } from "@/features/dashboard/api/booking-actions"
import {
  deletePaymentMethod,
  savePaymentMethod,
  setBookingPaid,
  setPayLater,
} from "@/features/dashboard/api/payment-actions"
import {
  refundBooking,
  saveOnlinePay,
} from "@/features/dashboard/api/online-pay-actions"
import {
  getOnlinePaySettings,
  getPaymentSettings,
} from "@/features/dashboard/api/payment-queries"
import { changeProgress } from "@/features/dashboard/api/customer-reward-changes"
import {
  removeRewardRule,
  saveRewardRule,
  setRewardRuleOn,
} from "@/features/dashboard/api/reward-actions"
import { getRewardSettings } from "@/features/dashboard/api/reward-queries"
import type {
  CantComeAction,
  MessageButton,
  NotificationMessage,
  NotificationSettings,
} from "@/features/dashboard/types/notifications"
import {
  BOOKING_MESSAGES,
  TEMPLATE_LANGUAGES,
  buttonsProblem,
  defaultButtons,
  messageFields,
  wordingProblem,
  type BookingMessage,
  type TemplateLanguage,
  type Wording,
} from "@/features/dashboard/utils/booking-templates"
import { drawTeamPhoto } from "@/features/starter-catalog/api/prepare-actions"
import {
  daysInRange,
  getBookingCounts,
  getBooking,
  getBookings,
  getBookingsBetween,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import {
  getCustomerBookings,
  getCustomerRewards,
  getCustomers,
} from "@/features/dashboard/api/customers"
import { getAddonGroups } from "@/features/dashboard/api/addon-queries"
import {
  getBusinessPhotos,
  getServiceTeams,
} from "@/features/dashboard/api/team-service-queries"
import { createOwnerBooking } from "@/features/booking/api/create-owner-booking"
import {
  getAvailability,
  getMoveAvailability,
} from "@/features/booking/api/get-availability"
import { moveOwnerBooking } from "@/features/booking/api/move-owner-booking"
import { checkAddons } from "@/features/booking/utils/addons"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { bookingStats } from "./booking-stats"
import { BOOKING_RULES, PHONE_PATTERN } from "@/lib/booking-rules"
import {
  formatClock,
  formatDay,
  formatWeekday,
} from "@/lib/format-booking-time"
import { durationIn, type DurationWords } from "@/lib/format-duration"
import { formatPrice } from "@/lib/format-price"
import { notificationRules } from "@/lib/platform-settings"
import { groupServices, inGroupOrder } from "@/lib/service-groups"
import {
  POLICY_KINDS,
  POLICY_POINT_ICONS,
  POLICY_RULES,
  isPolicyKind,
  isPolicyPointIcon,
} from "@/lib/policy-rules"
import {
  PAYMENT_RULES,
  PAYMENT_START_NAMES,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  CARD_TYPE,
  DEPOSIT_TYPES,
  ONLINE_PAY_MODES,
  ONLINE_PAY_RULES,
  checkOnlinePay,
  checkPaymentMethod,
  smallestCharge,
  type OnlinePay,
  type PaymentType,
} from "@/lib/payment-rules"
import {
  checkRewardRule,
  REWARD_EARN_TYPES,
  REWARD_RULES,
  REWARD_TYPES,
  rewardLastDay,
  type RewardRule,
  type RewardRuleForm,
} from "@/lib/reward-rules"
import { rewardWords, type RewardWordsText } from "@/lib/reward-words"
import { THEMES } from "@/lib/theme-rules"
import { getServiceNameTranslations } from "@/lib/translations/business-texts"
import { bookingActions } from "@/features/dashboard/utils/booking-filters"
import type {
  OwnerBooking,
  OwnerPolicy,
  OwnerPolicyPoint,
  PolicyPointInput,
  ServiceInput,
} from "@/features/dashboard/types"
import type { Automation } from "@/features/dashboard/types/automations"

// The same service twice: same name, whatever its capitals, same time and same
// price. One name at two lengths or prices is a real choice, and stays allowed.
function sameService(
  existing: {
    name: string
    durationMinutes: number
    priceMinor: number | null
  },
  wanted: { name: string; durationMinutes: number; priceMinor: number | null }
): boolean {
  return (
    existing.name.trim().toLocaleLowerCase() ===
      wanted.name.trim().toLocaleLowerCase() &&
    existing.durationMinutes === wanted.durationMinutes &&
    existing.priceMinor === wanted.priceMinor
  )
}

type OwnerData = Awaited<ReturnType<typeof getOwnerBusiness>>
type TeamRow = OwnerData["team"][number]
type CategoryRow = OwnerData["categories"][number]

// The services in the order the owner and customers see them: each category
// in its order, then Other. With no category it is the saved order.
function servicesInShownOrder(owned: OwnerData): OwnerData["services"] {
  return inGroupOrder(groupServices(owned.services, owned.categories))
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const STATUSES = ["confirmed", "cancelled", "completed", "no_show"] as const
// list_bookings' plain day choice, as days from today.
const DAY_OFFSETS = { yesterday: -1, today: 0, tomorrow: 1 } as const
const SETTABLE_STATUSES = ["confirmed", "completed", "no_show"] as const
type SettableStatus = (typeof SETTABLE_STATUSES)[number]

function settableStatus(value: unknown): SettableStatus | null {
  return SETTABLE_STATUSES.find((status) => status === value) ?? null
}

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

// The extras a booking or free-times lookup is for, as the owner said them.
const EXTRAS_PARAMETER = {
  type: "array",
  items: { type: "string" },
  description:
    "Extra names as the owner said them, omit for none; when the service needs an extra, it returns the choices to ask about",
}

// Finds a service or team member from the words the owner said ("classic
// haircut", "Kelly"), or an id. One exact name wins; otherwise one name
// sharing a word ("Kelly Bergen" heard for "Kelly Begin"). A service's
// names in the other languages count too (`otherNames`). Anything else
// returns the names to ask about. The tap card shows the full name, so the
// owner sees who was picked.
function pickByName<
  T extends { id: string; name: string; otherNames?: string[] },
>(list: T[], wanted: string): { found: T } | { choices: string[] } {
  const plain = (text: string) =>
    text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
  const words = (text: string) =>
    plain(text)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 1)
  const names = (item: T) => [item.name, ...(item.otherNames ?? [])]
  const exact = list.filter(
    (item) =>
      item.id === wanted ||
      names(item).some((name) => plain(name) === plain(wanted))
  )
  if (exact.length === 1) return { found: exact[0] }
  const said = new Set(words(wanted))
  const near = list.filter((item) =>
    names(item).some((name) => words(name).some((word) => said.has(word)))
  )
  if (near.length === 1) return { found: near[0] }
  return { choices: (near.length > 0 ? near : list).map((item) => item.name) }
}

// The business with each service's up-to-date names in the other
// languages added as `otherNames`, for pickByName.
async function getBusinessForNames(businessId: string) {
  const owned = await getOwnerBusiness(businessId)
  const translated = await getServiceNameTranslations(owned.business.id)
  return {
    ...owned,
    services: owned.services.map((service) => ({
      ...service,
      otherNames: translated
        .filter(
          (row) =>
            row.serviceId === service.id && row.sourceText === service.name
        )
        .map((row) => row.text),
    })),
  }
}

// The customers a name or phone text finds, as the Customers page would.
function customersMatching<T extends { name: string; phone: string | null }>(
  all: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase()
  const digits = q.replace(/\D/g, "")
  return all.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (digits.length > 0 && (c.phone ?? "").replace(/\D/g, "").includes(digits))
  )
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

// Why a time cannot be used that day, with the free ones to offer.
function notFreeError(
  t: ServerWords,
  locale: string,
  times: string[]
): string {
  return times.length > 0
    ? t("errors.slotNotFree", { times: times
          .slice(0, 12)
          .map((time) => `${formatClock(time, locale)} (${time})`)
          .join(", ") })
    : t("errors.dayNotFree")
}

// A week of hours in time order: one key to compare and one line for a card.
function sortedHours(rows: HoursInput[]): HoursInput[] {
  return [...rows].sort(
    (x, y) => x.weekday - y.weekday || x.opensAt.localeCompare(y.opensAt)
  )
}

function hoursKey(rows: HoursInput[]): string {
  return JSON.stringify(
    sortedHours(rows).map((row) => [row.weekday, row.opensAt, row.closesAt])
  )
}

function hoursLine(locale: string, rows: HoursInput[]): string {
  return sortedHours(rows)
    .map(
      (row) =>
        `${formatWeekday(row.weekday, locale)} ${formatClock(row.opensAt, locale)}–${formatClock(row.closesAt, locale)}`
    )
    .join(", ")
}

// The same ids as `existing`, each once, in the new order, or null. The
// reorder actions take a whole list, so a missing id must never reach them.
function newOrder(value: unknown, existing: string[]): string[] | null {
  return Array.isArray(value) &&
    value.length === existing.length &&
    new Set(value).size === value.length &&
    value.every((id) => typeof id === "string" && existing.includes(id))
    ? (value as string[])
    : null
}

// A true or false argument: undefined keeps `current`, anything else is null.
function flagOr(value: unknown, current: boolean): boolean | null {
  if (value === undefined) return current
  return typeof value === "boolean" ? value : null
}

// The extras the owner said for one service, matched like services are
// (pickByName), then checked with the booking page's own rule
// (checkAddons), so the free times and the total fit what is booked.
interface PickedExtras {
  ids: string[]
  names: string[]
  extraMinutes: number
  extraPriceMinor: number | null
}

async function pickExtras(
  businessId: string,
  service: { id: string; name: string },
  wanted: unknown,
  t: ServerWords
): Promise<PickedExtras | { error: string }> {
  const said = wanted === undefined || wanted === null ? [] : wanted
  if (
    !Array.isArray(said) ||
    said.length > BOOKING_RULES.maxAddonOptions ||
    said.some((name) => typeof name !== "string" || name.trim() === "")
  ) {
    return { error: t("errors.extrasInvalid") }
  }
  const groups = (await getAddonGroups(businessId)).filter((group) =>
    group.serviceIds.includes(service.id)
  )
  const options = groups.flatMap((group) => group.options)
  if (said.length > 0 && options.length === 0) {
    return { error: t("errors.noExtras", { service: service.name }) }
  }
  const ids = new Set<string>()
  for (const name of said as string[]) {
    const pick = pickByName(options, name)
    if ("choices" in pick) {
      return { error: t("errors.extraWhich", { names: pick.choices.join(", ") }) }
    }
    ids.add(pick.found.id)
  }
  // Ask about the first group with too few or too many picks.
  for (const group of groups) {
    const picked = group.options.filter((option) => ids.has(option.id))
    if (picked.length < group.minSelect) {
      return {
        error: t("errors.extraNeeded", { group: group.prompt || group.name, count: String(group.minSelect), names: group.options.map((option) => option.name).join(", ") }),
      }
    }
    if (group.maxSelect !== null && picked.length > group.maxSelect) {
      return { error: t("errors.extraTooMany", { group: group.name, count: String(group.maxSelect) }) }
    }
  }
  const checked = checkAddons(groups, [...ids])
  if (!checked.ok) {
    return { error: t("errors.extrasInvalid") }
  }
  return {
    ids: checked.options.map((option) => option.id),
    names: checked.options.map((option) => option.name),
    extraMinutes: checked.extraMinutes,
    extraPriceMinor: checked.extraPriceMinor,
  }
}

// Checked arguments for create_booking, shared by describe and execute.
interface CheckedBooking {
  service: { id: string; name: string; priceMinor: number | null }
  extras: PickedExtras
  durationMinutes: number
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

// The booking a create_booking card shows, stored for the tap: names and
// "today" already turned into ids and a date, so the tap books exactly
// this even after midnight or a rename.
interface BookingToRun {
  serviceId: string
  serviceName: string
  teamMemberId: string | null
  addonIds: string[]
  date: string
  time: string
  name: string
  phone: string | null
  note: string | null
}

function bookingToRun(checked: CheckedBooking): BookingToRun {
  return {
    serviceId: checked.service.id,
    serviceName: checked.service.name,
    teamMemberId: checked.memberId,
    addonIds: checked.extras.ids,
    date: checked.date,
    time: checked.time,
    name: checked.name,
    phone: checked.phone,
    note: checked.note,
  }
}

// The stored booking back, or null when it is not one. Only describe
// stores it, so null means a broken store, never a model mistake.
function asBookingToRun(args: unknown): BookingToRun | null {
  const a = asRecord(args)
  const text = (value: unknown) => typeof value === "string" && value !== ""
  const textOrNull = (value: unknown) =>
    value === null || typeof value === "string"
  if (
    !a ||
    !text(a.serviceId) ||
    !text(a.serviceName) ||
    !(a.teamMemberId === null || text(a.teamMemberId)) ||
    !Array.isArray(a.addonIds) ||
    !a.addonIds.every(text) ||
    typeof a.date !== "string" ||
    !isRealDate(a.date) ||
    typeof a.time !== "string" ||
    !TIME_RE.test(a.time) ||
    !text(a.name) ||
    !textOrNull(a.phone) ||
    !textOrNull(a.note)
  ) {
    return null
  }
  return a as unknown as BookingToRun
}

async function checkBookingArgs(
  businessId: string,
  args: unknown,
  t: ServerWords,
  locale: string,
  now = Date.now()
): Promise<CheckedBooking | { error: string }> {
  const a = asRecord(args)
  // Names as the owner said them; ids work too.
  const serviceWanted = a?.service ?? a?.serviceId
  if (!a || typeof serviceWanted !== "string" || serviceWanted.trim() === "") {
    return { error: t("errors.serviceRequired") }
  }
  const memberRaw = a.teamMember ?? a.teamMemberId
  const memberWanted =
    memberRaw === undefined || memberRaw === null ? null : memberRaw
  if (
    memberWanted !== null &&
    (typeof memberWanted !== "string" || memberWanted.trim() === "")
  ) {
    return { error: t("errors.teamMemberInvalid") }
  }
  if (a.day !== undefined && a.day !== "today" && a.day !== "tomorrow") {
    return { error: t("errors.bookingDayInvalid") }
  }
  if (
    a.day === undefined &&
    (typeof a.date !== "string" || !isRealDate(a.date))
  ) {
    return { error: t("errors.dateInvalid") }
  }
  if (typeof a.time !== "string" || !TIME_RE.test(a.time)) {
    return { error: t("errors.timeInvalid") }
  }
  const name = validName(a.name, BOOKING_RULES.maxCustomerName)
  if (!name) {
    return { error: t("errors.nameRequired") }
  }
  const phoneRaw = a.phone === undefined || a.phone === null ? "" : a.phone
  if (typeof phoneRaw !== "string") {
    return { error: t("errors.phoneInvalid") }
  }
  const phone = phoneRaw.trim() === "" ? null : phoneRaw.trim()
  if (phone !== null && !PHONE_PATTERN.test(phone)) {
    return { error: t("errors.phoneInvalid") }
  }
  const noteRaw = a.note === undefined || a.note === null ? "" : a.note
  if (typeof noteRaw !== "string") {
    return { error: t("errors.noteInvalid") }
  }
  const note = noteRaw.trim() === "" ? null : noteRaw.trim()
  if (note !== null && note.length > BOOKING_RULES.maxNote) {
    return { error: t("errors.noteTooLong") }
  }
  const { business, services, team } = await getBusinessForNames(businessId)
  const today = zonedToday(now, business.timezone)
  const date =
    a.day === "today"
      ? today
      : a.day === "tomorrow"
        ? addDaysStr(today, 1)
        : (a.date as string)
  if (date < today) {
    return { error: t("errors.datePast") }
  }
  const servicePick = pickByName(services, serviceWanted)
  if ("choices" in servicePick) {
    return { error: t("errors.serviceWhich", { names: servicePick.choices.join(", ") }) }
  }
  const service = servicePick.found
  let member: { id: string; name: string } | null = null
  if (memberWanted !== null) {
    const memberPick = pickByName(team, memberWanted)
    if ("choices" in memberPick) {
      return { error: t("errors.memberWhich", { names: memberPick.choices.join(", ") }) }
    }
    member = memberPick.found
  }
  const memberId = member?.id ?? null
  const extras = await pickExtras(businessId, service, a.extras, t)
  if ("error" in extras) {
    return extras
  }
  // Checked here, so a card is only shown for a time that is free for the
  // service with its extras.
  const free = await getAvailability(
    business.slug,
    service.id,
    memberId,
    extras.ids
  )
  if (!free) {
    return { error: t("errors.freeTimesUnknown") }
  }
  const times = free.days.find((day) => day.date === date)?.times ?? []
  if (!times.includes(a.time)) {
    return { error: notFreeError(t, locale, times) }
  }
  // The total as the booking stores it (createOwnerBooking): no price only
  // when neither the service nor an extra has one.
  const priceMinor =
    service.priceMinor === null
      ? extras.extraPriceMinor
      : service.priceMinor + (extras.extraPriceMinor ?? 0)
  return {
    service: {
      id: service.id,
      name: service.name,
      priceMinor: service.priceMinor,
    },
    extras,
    durationMinutes: service.durationMinutes + extras.extraMinutes,
    memberId,
    memberName: member?.name ?? t("booking.anyone"),
    date,
    time: a.time,
    name,
    phone,
    note,
    price: priceText(t, locale, priceMinor, business.currency),
    timeZone: business.timezone,
  }
}

// Ready-made words for times, days and prices, in the owner's language
// and as the booking cards show them ("5:50 PM", "Friday, October 31",
// "€25.00"). Results carry them next to the raw values, which stay for
// tool calls, so answers never repeat "17:50" or cents and the voice
// gets text it can read (ElevenLabs normalization guide:
// https://elevenlabs.io/docs/best-practices/prompting/normalization).
function priceText(
  t: ServerWords,
  locale: string,
  priceMinor: number | null,
  currency: string
): string {
  return priceMinor === null
    ? t("booking.noPrice")
    : priceMinor === 0
      ? t("booking.free")
      : formatPrice(priceMinor, currency, locale)
}

function dayText(locale: string, date: string | null): string | null {
  return date === null ? null : formatDay(date, locale)
}

function hoursText(
  locale: string,
  rows: { weekday: number; opensAt: string; closesAt: string }[]
) {
  return rows.map(({ weekday, opensAt, closesAt }) => ({
    weekday,
    opensAt,
    closesAt,
    weekdayText: formatWeekday(weekday, locale),
    opensAtText: formatClock(opensAt, locale),
    closesAtText: formatClock(closesAt, locale),
  }))
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
  // The category before, and the one asked for: undefined when categoryId
  // was left out, so the service keeps its own; null is no category.
  currentCategory: CategoryRow | null
  category: CategoryRow | null | undefined
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

// The category a service goes in, from the model's categoryId: left out is
// undefined, "none" (or null) is no category, anything else must be one of
// the business's own.
function pickCategory(
  value: unknown,
  categories: CategoryRow[]
): CategoryRow | null | undefined | "unknown" {
  if (value === undefined) {
    return undefined
  }
  if (value === null || value === "none") {
    return null
  }
  return categories.find((category) => category.id === value) ?? "unknown"
}

// A category name as the action saves it: trimmed, spaces joined, so the
// card shows what the tap saves.
function validCategoryName(value: unknown): string | null {
  const name = validName(value, BOOKING_RULES.maxServiceCategoryName)
  return name && name.replace(/\s+/g, " ")
}

// A category name is used once per business, whatever its capitals.
function sameCategoryName(a: string, b: string): boolean {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase()
}

// The words the tools write for the owner, in the owner's language (read
// once per request, never from the body): the assistant's own lines, the
// owner area's names, lengths of time, and the locale dates, times and
// prices read in.
export interface ToolWords {
  language: PageLanguage
  locale: string
  t: ServerWords
  owner: OwnerWords
  duration: DurationWords
  rewards: RewardWordsText
}

export async function toolWords(language: PageLanguage): Promise<ToolWords> {
  const [t, owner, duration, rewards] = await Promise.all([
    getTranslations({ locale: language, namespace: "assistantServer" }),
    getTranslations({ locale: language, namespace: "owner" }),
    getTranslations({ locale: language, namespace: "app.duration" }),
    getTranslations({ locale: language, namespace: "app.rewards" }),
  ])
  return {
    language,
    locale: DEFAULT_LOCALES[language],
    t,
    owner,
    duration,
    rewards,
  }
}

// Tools closed over the checked businessId and ownerId. The model never
// sees or sets either. Lists drop rows past the cap and always
// report total + truncated, so the model never claims a capped list
// is complete.
export function buildAssistantTools(
  businessId: string,
  ownerId: string,
  words: ToolWords
): AssistantTool[] {
  // Every owner-facing line in the owner's language, and the owner area's
  // own names for policies, messages and automations.
  const { language, locale, t, owner: ownerT, duration } = words
  const formatDuration = (minutes: number) => durationIn(duration, minutes)
  // The booking to cancel, by id, only when the bookings screen would let
  // the owner cancel it (confirmed, not started yet). Describe and execute
  // both use this.
  const cancellableBooking = async (
    bookingId: string
  ): Promise<OwnerBooking | "unknown" | "cancelled" | "started"> => {
    const booking = await getBooking(businessId, bookingId)
    if (!booking) return "unknown"
    if (bookingActions(booking, new Date().toISOString()).includes("cancel")) {
      return booking
    }
    return booking.status === "cancelled" ? "cancelled" : "started"
  }
  // Shared checks for update_service: describe and execute both use this,
  // re-reading the service each time because it may change between calls.
  const checkUpdateServiceArgs = async (
    args: unknown
  ): Promise<CheckedServiceUpdate | { error: string }> => {
    const a = asRecord(args)
    if (!a || typeof a.serviceId !== "string" || a.serviceId === "") {
      return { error: t("errors.serviceIdRequired") }
    }
    const { business, services, categories } =
      await getOwnerBusiness(businessId)
    const current = services.find((s) => s.id === a.serviceId)
    if (!current) {
      return { error: t("errors.serviceUnknown") }
    }
    const category = pickCategory(a.categoryId, categories)
    if (category === "unknown") {
      return { error: t("errors.serviceCategoryInvalid") }
    }
    const name =
      a.name === undefined
        ? current.name
        : validName(a.name, BOOKING_RULES.maxServiceName)
    if (!name) {
      return { error: t("errors.nameInvalid", { max: String(BOOKING_RULES.maxServiceName) }) }
    }
    const durationMinutes =
      a.minutes === undefined
        ? current.durationMinutes
        : validMinutes(a.minutes)
    if (!durationMinutes) {
      return {
        error: t("errors.minutesInvalid", { options: (BOOKING_RULES.serviceMinutes as readonly number[]).join(", ") }),
      }
    }
    const priceMinor =
      a.priceMinor === undefined
        ? current.priceMinor
        : validPriceMinor(a.priceMinor)
    if (priceMinor === "invalid") {
      return { error: t("errors.priceInvalid") }
    }
    const description =
      a.description === undefined
        ? current.description
        : validDescription(a.description)
    if (description === "invalid") {
      return {
        error: t("errors.descriptionInvalid", { max: String(BOOKING_RULES.maxServiceDescription) }),
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
      currentCategory:
        categories.find((c) => c.id === current.categoryId) ?? null,
      category,
    }
  }
  // Shared checks for set_service_team: describe and execute both use this.
  const checkServiceTeamArgs = async (
    args: unknown
  ): Promise<
    | {
        service: { id: string; name: string }
        memberIds: string[]
        team: { id: string; name: string }[]
      }
    | { error: string }
  > => {
    const a = asRecord(args)
    if (!a || typeof a.serviceId !== "string" || a.serviceId === "") {
      return { error: t("errors.serviceIdRequired") }
    }
    if (
      !Array.isArray(a.teamMemberIds) ||
      !a.teamMemberIds.every((id) => typeof id === "string")
    ) {
      return { error: t("errors.memberUnknown") }
    }
    const { services, team } = await getOwnerBusiness(businessId)
    const service = services.find((s) => s.id === a.serviceId)
    if (!service) {
      return { error: t("errors.serviceUnknown") }
    }
    const memberIds = [...new Set(a.teamMemberIds as string[])]
    if (memberIds.some((id) => !team.some((m) => m.id === id))) {
      return { error: t("errors.memberUnknown") }
    }
    return { service, memberIds, team }
  }
  // Shared checks for set_member_services: describe and execute both use this.
  const checkMemberServicesArgs = async (
    args: unknown
  ): Promise<
    | {
        member: { id: string; name: string }
        serviceIds: string[]
        services: { id: string; name: string }[]
      }
    | { error: string }
  > => {
    const a = asRecord(args)
    if (!a || typeof a.teamMemberId !== "string" || a.teamMemberId === "") {
      return { error: t("errors.memberIdRequired") }
    }
    if (
      !Array.isArray(a.serviceIds) ||
      !a.serviceIds.every((id) => typeof id === "string")
    ) {
      return { error: t("errors.serviceUnknown") }
    }
    const { services, team } = await getOwnerBusiness(businessId)
    const member = team.find((m) => m.id === a.teamMemberId)
    if (!member) {
      return { error: t("errors.memberUnknown") }
    }
    const serviceIds = [...new Set(a.serviceIds as string[])]
    if (serviceIds.some((id) => !services.some((s) => s.id === id))) {
      return { error: t("errors.serviceUnknown") }
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
    return {
      id,
      name,
      description,
      priceMinor,
      durationMinutes: o.durationMinutes,
    }
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
      return { error: t("errors.optionsInvalid", { max: String(BOOKING_RULES.maxAddonOptions) }) }
    }
    const name =
      a.name === undefined && current
        ? current.name
        : validName(a.name, BOOKING_RULES.maxAddonName)
    if (!name) {
      return { error: t("errors.nameInvalid", { max: String(BOOKING_RULES.maxAddonName) }) }
    }
    const prompt =
      a.prompt === undefined && current
        ? current.prompt
        : validName(a.prompt, BOOKING_RULES.maxAddonPrompt)
    if (!prompt) {
      return {
        error: t("errors.promptInvalid", { max: String(BOOKING_RULES.maxAddonPrompt) }),
      }
    }
    const rawOptions =
      a.options === undefined
        ? (current?.options.map((o) => ({ ...o })) ?? null)
        : checkAddonOptions(a.options, current !== null)
    if (!rawOptions) {
      return { error: t("errors.optionsInvalid", { max: String(BOOKING_RULES.maxAddonOptions) }) }
    }
    if (current) {
      const currentIds = new Set(current.options.map((o) => o.id))
      if (rawOptions.some((o) => o.id !== null && !currentIds.has(o.id))) {
        return { error: t("errors.optionsInvalid", { max: String(BOOKING_RULES.maxAddonOptions) }) }
      }
    }
    const minSelect =
      a.minSelect === undefined && current ? current.minSelect : a.minSelect
    const maxSelect =
      a.maxSelect === undefined ? (current?.maxSelect ?? null) : a.maxSelect
    if (
      !Number.isInteger(minSelect) ||
      (minSelect as number) < 0 ||
      (minSelect as number) > rawOptions.length ||
      (maxSelect !== null &&
        (!Number.isInteger(maxSelect) ||
          (maxSelect as number) < Math.max(1, minSelect as number) ||
          (maxSelect as number) > rawOptions.length))
    ) {
      return { error: t("errors.selectsInvalid") }
    }
    const { services } = await getOwnerBusiness(businessId)
    const rawServiceIds =
      a.serviceIds === undefined && current ? current.serviceIds : a.serviceIds
    if (
      !Array.isArray(rawServiceIds) ||
      !rawServiceIds.every((id) => typeof id === "string")
    ) {
      return { error: t("errors.serviceUnknown") }
    }
    const serviceIds = [...new Set(rawServiceIds as string[])]
    if (serviceIds.some((id) => !services.some((s) => s.id === id))) {
      return { error: t("errors.serviceUnknown") }
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
      return { error: t("errors.nothingToChange") }
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
        error: t("errors.businessNameInvalid", { max: String(BOOKING_RULES.maxBusinessName) }),
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
      return {
        error: t("errors.addressInvalid", { max: String(BOOKING_RULES.maxBusinessAddress) }),
      }
    }
    const description = textField(
      a.description,
      BOOKING_RULES.maxBusinessDescription
    )
    if (description === "invalid") {
      return {
        error: t("errors.aboutInvalid", { max: String(BOOKING_RULES.maxBusinessDescription) }),
      }
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
      return { error: t("errors.phoneInvalid") }
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
      return { error: t("errors.websiteInvalid") }
    }
    const seats = a.seats === undefined ? current.seats : a.seats
    if (
      typeof seats !== "number" ||
      !Number.isInteger(seats) ||
      seats < 1 ||
      seats > BOOKING_RULES.maxSeats
    ) {
      return { error: t("errors.seatsInvalid", { max: String(BOOKING_RULES.maxSeats) }) }
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
  // Shared checks for move_booking: the booking must still be movable and
  // the time free for its person and length, with "today" turned into a date.
  const checkMoveArgs = async (
    args: unknown
  ): Promise<
    { booking: OwnerBooking; date: string; time: string } | { error: string }
  > => {
    const a = asRecord(args)
    if (!a || typeof a.bookingId !== "string" || a.bookingId === "") {
      return { error: t("errors.bookingIdRequired") }
    }
    if (a.day !== undefined && a.day !== "today" && a.day !== "tomorrow") {
      return { error: t("errors.bookingDayInvalid") }
    }
    if (
      a.day === undefined &&
      (typeof a.date !== "string" || !isRealDate(a.date))
    ) {
      return { error: t("errors.dateInvalid") }
    }
    if (typeof a.time !== "string" || !TIME_RE.test(a.time)) {
      return { error: t("errors.timeInvalid") }
    }
    const booking = await getBooking(businessId, a.bookingId)
    if (!booking) {
      return { error: t("errors.bookingUnknown") }
    }
    if (!bookingActions(booking, new Date().toISOString()).includes("move")) {
      return {
        error:
          booking.status === "cancelled"
            ? t("errors.bookingCancelled")
            : t("errors.bookingNotMovable"),
      }
    }
    const { business } = await getOwnerBusiness(businessId)
    const today = zonedToday(Date.now(), business.timezone)
    const date =
      a.day === "today"
        ? today
        : a.day === "tomorrow"
          ? addDaysStr(today, 1)
          : (a.date as string)
    if (date < today) {
      return { error: t("errors.datePast") }
    }
    if (date === booking.date && a.time === booking.time) {
      return { error: t("errors.nothingToChange") }
    }
    const free = await getMoveAvailability(businessId, ownerId, booking.id)
    if (!free) {
      return { error: t("errors.moveUnavailable") }
    }
    const times = free.days.find((day) => day.date === date)?.times ?? []
    if (!times.includes(a.time)) {
      return { error: notFreeError(t, locale, times) }
    }
    return { booking, date, time: a.time }
  }
  // Checked arguments for add_customer, shared by describe and execute.
  const checkCustomerArgs = (
    args: unknown
  ): { name: string; phone: string | null } | { error: string } => {
    const a = asRecord(args)
    const name = a && validName(a.name, BOOKING_RULES.maxCustomerName)
    if (!a || !name) {
      return { error: t("errors.nameRequired") }
    }
    const raw = a.phone === undefined || a.phone === null ? "" : a.phone
    if (typeof raw !== "string") {
      return { error: t("errors.phoneInvalid") }
    }
    const phone = raw.trim() === "" ? null : raw.trim()
    if (phone !== null && !PHONE_PATTERN.test(phone)) {
      return { error: t("errors.phoneInvalid") }
    }
    return { name, phone }
  }
  // Shared checks for set_member_hours. rows null means the business's hours.
  const checkMemberHoursArgs = async (
    args: unknown
  ): Promise<
    { member: TeamRow; rows: HoursInput[] | null } | { error: string }
  > => {
    const a = asRecord(args)
    if (!a || typeof a.memberId !== "string" || a.memberId === "") {
      return { error: t("errors.memberIdRequired") }
    }
    const rows = a.rows === null ? null : validHoursRows(a.rows)
    if (a.rows !== null && (!rows || rows.length === 0)) {
      return { error: t("errors.rowsInvalid", { max: String(BOOKING_RULES.maxHoursRows) }) }
    }
    const { team, memberHours } = await getOwnerBusiness(businessId)
    const member = team.find((m) => m.id === a.memberId)
    if (!member) {
      return { error: t("errors.memberUnknown") }
    }
    const custom = memberHours.filter((row) => row.teamMemberId === member.id)
    const unchanged = rows
      ? hoursKey(rows) === hoursKey(custom)
      : custom.length === 0
    return unchanged ? { error: t("errors.nothingToChange") } : { member, rows }
  }
  // One team member by id, for the tools that only name who they act on.
  const findMember = async (
    args: unknown
  ): Promise<
    { business: OwnerData["business"]; member: TeamRow } | { error: string }
  > => {
    const a = asRecord(args)
    if (!a || typeof a.memberId !== "string" || a.memberId === "") {
      return { error: t("errors.memberIdRequired") }
    }
    const { business, team } = await getOwnerBusiness(businessId)
    const member = team.find((m) => m.id === a.memberId)
    return member ? { business, member } : { error: t("errors.memberUnknown") }
  }
  // Shared checks for create_service: the card and the tap read the same.
  const checkCreateServiceArgs = (
    args: unknown
  ): ServiceInput | { error: string } => {
    const a = asRecord(args)
    const name = a && validName(a.name, BOOKING_RULES.maxServiceName)
    if (!name) {
      return { error: t("errors.nameInvalid", { max: String(BOOKING_RULES.maxServiceName) }) }
    }
    const durationMinutes = a && validMinutes(a.minutes)
    if (!durationMinutes) {
      return {
        error: t("errors.minutesInvalid", { options: (BOOKING_RULES.serviceMinutes as readonly number[]).join(", ") }),
      }
    }
    const priceMinor =
      a && "priceMinor" in a ? validPriceMinor(a.priceMinor) : "invalid"
    if (priceMinor === "invalid") {
      return { error: t("errors.priceInvalid") }
    }
    const description = a ? validDescription(a.description) : "invalid"
    if (description === "invalid") {
      return {
        error: t("errors.descriptionInvalid", { max: String(BOOKING_RULES.maxServiceDescription) }),
      }
    }
    return { name, description, durationMinutes, priceMinor }
  }
  // One service category by id, for the tools that act on one.
  const findServiceCategory = async (
    args: unknown
  ): Promise<
    { category: CategoryRow; categories: CategoryRow[] } | { error: string }
  > => {
    const a = asRecord(args)
    if (!a || typeof a.categoryId !== "string" || a.categoryId === "") {
      return { error: t("errors.serviceCategoryIdRequired") }
    }
    const { categories } = await getOwnerBusiness(businessId)
    const category = categories.find((c) => c.id === a.categoryId)
    return category
      ? { category, categories }
      : { error: t("errors.serviceCategoryUnknown") }
  }
  // Shared checks for rename_service_category: the card and the tap read
  // the same. A name another category has is the card's check; the action
  // checks it again at the tap.
  const checkRenameCategoryArgs = async (
    args: unknown
  ): Promise<
    | { category: CategoryRow; categories: CategoryRow[]; name: string }
    | { error: string }
  > => {
    const found = await findServiceCategory(args)
    if ("error" in found) {
      return found
    }
    const name = validCategoryName(asRecord(args)?.name)
    if (!name) {
      return {
        error: t("errors.nameInvalid", { max: String(BOOKING_RULES.maxServiceCategoryName) }),
      }
    }
    if (name === found.category.name) {
      return { error: t("errors.nothingToChange") }
    }
    return { ...found, name }
  }
  // Shared checks for rename_team_member.
  const checkRenameArgs = async (
    args: unknown
  ): Promise<{ member: TeamRow; name: string } | { error: string }> => {
    const found = await findMember(args)
    if ("error" in found) {
      return found
    }
    const name = validName(asRecord(args)?.name, BOOKING_RULES.maxTeamName)
    if (!name) {
      return { error: t("errors.nameInvalid", { max: String(BOOKING_RULES.maxTeamName) }) }
    }
    if (name === found.member.name) {
      return { error: t("errors.nothingToChange") }
    }
    return { member: found.member, name }
  }
  // The card for set_booking_status, under setBookingStatus's own rules, so
  // no card shows for a change the tap would refuse.
  const checkBookingStatusArgs = async (
    args: unknown
  ): Promise<
    { booking: OwnerBooking; status: SettableStatus } | { error: string }
  > => {
    const a = asRecord(args)
    if (!a || typeof a.bookingId !== "string" || a.bookingId === "") {
      return { error: t("errors.bookingIdRequired") }
    }
    const status = settableStatus(a.status)
    if (!status) {
      return { error: t("errors.statusInvalid") }
    }
    const booking = await getBooking(businessId, a.bookingId)
    if (!booking) {
      return { error: t("errors.bookingUnknown") }
    }
    if (booking.status === "cancelled") {
      return { error: t("errors.bookingCancelled") }
    }
    if (status !== "confirmed" && booking.startAt > new Date().toISOString()) {
      return { error: t("errors.bookingNotStarted") }
    }
    if (booking.status === status) {
      return { error: t("errors.nothingToChange") }
    }
    return { booking, status }
  }
  // What customers pay by card, in the owner's words: "Off", "Full
  // price", "25% deposit", "$10.00 deposit".
  const onlinePayText = (pay: OnlinePay | null, currency: string) => {
    if (!pay) return t("onlinePayment.summary.off")
    if (pay.mode === "full") return t("onlinePayment.summary.full")
    return pay.type === "percent"
      ? t("onlinePayment.summary.percent", { percent: pay.value })
      : t("onlinePayment.summary.amount", {
          amount: formatPrice(pay.value, currency, locale),
        })
  }
  // Shared checks for set_online_payment: a setting the rules allow, a
  // plan that has online payments, a Stripe account first, and a change
  // that is one.
  const checkOnlinePayArgs = async (
    args: unknown
  ): Promise<
    | {
        pay: OnlinePay | null
        currency: string
        input: { mode: string; type?: string; value?: number }
      }
    | { error: string }
  > => {
    const a = asRecord(args)
    const online = await getOnlinePaySettings(businessId)
    const input = {
      mode: a?.mode,
      type: a?.depositType,
      value: a?.depositValue,
    }
    const checked = checkOnlinePay(input, online.currency)
    if (!checked.ok) {
      return {
        error: t(`errors.onlinePayment.${checked.error}`, {
          min: String(ONLINE_PAY_RULES.minPercent),
          max: String(ONLINE_PAY_RULES.maxPercent),
          amount: String(smallestCharge(online.currency)),
        }),
      }
    }
    if (!online.available) {
      return { error: t("errors.onlinePayment.plan") }
    }
    if (
      checked.pay &&
      (online.stripe === "none" || online.stripe === "country")
    ) {
      return { error: t("errors.onlinePayment.notConnected") }
    }
    if (JSON.stringify(checked.pay) === JSON.stringify(online.pay)) {
      return { error: t("errors.nothingToChange") }
    }
    const { pay } = checked
    return {
      pay,
      currency: online.currency,
      input:
        pay?.mode === "deposit"
          ? { mode: pay.mode, type: pay.type, value: pay.value }
          : { mode: pay?.mode ?? "off" },
    }
  }
  // Shared checks for refund_booking: a booking paid by card that still
  // holds something to give back.
  const checkRefundArgs = async (
    args: unknown
  ): Promise<{ booking: OwnerBooking; amountMinor: number } | { error: string }> => {
    const a = asRecord(args)
    if (!a || typeof a.bookingId !== "string" || a.bookingId === "") {
      return { error: t("errors.bookingIdRequired") }
    }
    const booking = await getBooking(businessId, a.bookingId)
    if (!booking) {
      return { error: t("errors.bookingUnknown") }
    }
    const online = booking.payment?.online
    const amountMinor = online ? online.paidMinor - online.refundedMinor : 0
    if (amountMinor <= 0) {
      return { error: t("errors.nothingToRefund") }
    }
    return { booking, amountMinor }
  }
  // Shared checks for set_booking_paid: a booking that tracks a payment,
  // and a change that is one.
  const checkBookingPaidArgs = async (
    args: unknown
  ): Promise<{ booking: OwnerBooking; paid: boolean } | { error: string }> => {
    const a = asRecord(args)
    if (!a || typeof a.bookingId !== "string" || a.bookingId === "") {
      return { error: t("errors.bookingIdRequired") }
    }
    if (typeof a.paid !== "boolean") {
      return { error: t("errors.paidInvalid") }
    }
    const booking = await getBooking(businessId, a.bookingId)
    if (!booking) {
      return { error: t("errors.bookingUnknown") }
    }
    if (!booking.payment) {
      return { error: t("errors.noPayment") }
    }
    if ((booking.payment.status === "paid") === a.paid) {
      return { error: t("errors.nothingToChange") }
    }
    return { booking, paid: a.paid }
  }
  // A reward rule as the model reads it: the words the owner sees next to
  // the raw values, which stay for tool calls.
  const rewardRow = (rule: RewardRule, currency: string, timeZone: string) => {
    const say = rewardWords(words.rewards, locale, currency)
    const endsOn = rewardLastDay(rule.endsAt, timeZone)
    return {
      id: rule.id,
      on: rule.status === "active",
      earnsText: say.earn(rule),
      givesText: say.prize(rule),
      earnType: rule.earnType,
      goal: rule.goal,
      earnServiceIds: rule.earnServices?.map((service) => service.id) ?? null,
      earnMinPriceMinor: rule.earnMinPriceMinor,
      rewardType: rule.rewardType,
      rewardValue: rule.rewardValue,
      rewardCount: rule.rewardCount,
      rewardServiceIds:
        rule.rewardServices?.map((service) => service.id) ?? null,
      maxDiscountMinor: rule.maxDiscountMinor,
      expiresDays: rule.expiresDays,
      endsOn,
      endsOnText: dayText(locale, endsOn),
      maxPerCustomer: rule.maxPerCustomer,
      paidOnly: rule.paidOnly,
    }
  }
  // A rule's limits, one short part each, for a card.
  const rewardLimits = (
    rule: Pick<
      RewardRule,
      | "earnMinPriceMinor"
      | "maxDiscountMinor"
      | "expiresDays"
      | "maxPerCustomer"
      | "paidOnly"
    >,
    endsOn: string | null,
    currency: string
  ): string[] => [
    ...(rule.earnMinPriceMinor === null
      ? []
      : [
          t("reward.limits.minPrice", {
            amount: formatPrice(rule.earnMinPriceMinor, currency, locale),
          }),
        ]),
    ...(rule.paidOnly ? [t("reward.limits.paidOnly")] : []),
    ...(rule.maxDiscountMinor === null
      ? []
      : [
          t("reward.limits.cap", {
            amount: formatPrice(rule.maxDiscountMinor, currency, locale),
          }),
        ]),
    ...(rule.expiresDays === null
      ? []
      : [t("reward.limits.expires", { days: rule.expiresDays })]),
    ...(rule.maxPerCustomer === null
      ? []
      : [t("reward.limits.perCustomer", { count: rule.maxPerCustomer })]),
    ...(endsOn === null
      ? []
      : [t("reward.limits.ends", { day: formatDay(endsOn, locale) })]),
  ]
  // The business's rewards, or the error for a plan without them.
  const rewardSettings = async () => {
    const settings = await getRewardSettings(businessId)
    return settings.available
      ? settings
      : { error: t("errors.rewardsLocked") }
  }
  // One of the business's rules by its id.
  const rewardRule = async (args: unknown) => {
    const settings = await rewardSettings()
    if ("error" in settings) return settings
    const ruleId = asRecord(args)?.ruleId
    const rule = settings.rules.find((item) => item.id === ruleId)
    return rule ? { settings, rule } : { error: t("errors.rewardUnknown") }
  }
  // Shared checks for save_reward: a new rule (no ruleId), or one of the
  // business's with what changes; the rest is kept. Checked the way the
  // action checks it, so the card shows what the tap saves.
  const checkRewardArgs = async (
    args: unknown
  ): Promise<
    | { error: string }
    | {
        ruleId: string | null
        form: RewardRuleForm
        summary: string
      }
  > => {
    const a = asRecord(args) ?? {}
    const [settings, { business, services }] = await Promise.all([
      rewardSettings(),
      getOwnerBusiness(businessId),
    ])
    if ("error" in settings) return settings
    const current =
      a.ruleId === undefined
        ? null
        : settings.rules.find((item) => item.id === a.ruleId)
    if (current === undefined) return { error: t("errors.rewardUnknown") }
    if (current === null && settings.rules.length >= REWARD_RULES.maxRules) {
      return {
        error: t("errors.rewardsFull", { max: String(REWARD_RULES.maxRules) }),
      }
    }
    const saved: Record<keyof RewardRuleForm, unknown> = current
      ? {
          earnType: current.earnType,
          earnServiceIds:
            current.earnServices?.map((service) => service.id) ?? null,
          earnMinPriceMinor: current.earnMinPriceMinor,
          goal: current.goal,
          rewardType: current.rewardType,
          rewardValue: current.rewardValue,
          rewardCount: current.rewardCount,
          rewardServiceIds:
            current.rewardServices?.map((service) => service.id) ?? null,
          maxDiscountMinor: current.maxDiscountMinor,
          expiresDays: current.expiresDays,
          endsOn: rewardLastDay(current.endsAt, business.timezone),
          maxPerCustomer: current.maxPerCustomer,
          paidOnly: current.paidOnly,
        }
      : {
          earnType: undefined,
          earnServiceIds: null,
          earnMinPriceMinor: null,
          goal: undefined,
          rewardType: undefined,
          rewardValue: null,
          rewardCount: 1,
          rewardServiceIds: null,
          maxDiscountMinor: null,
          expiresDays: null,
          endsOn: null,
          maxPerCustomer: null,
          paidOnly: false,
        }
    // What was given wins; what was left out keeps what is saved.
    const wanted = Object.fromEntries(
      Object.entries(saved).map(([key, value]) => [
        key,
        a[key] === undefined ? value : a[key],
      ])
    ) as Record<keyof RewardRuleForm, unknown>
    const { endsOn, ...rest } = wanted
    if (
      endsOn !== null &&
      (typeof endsOn !== "string" ||
        !isRealDate(endsOn) ||
        endsOn < zonedToday(Date.now(), business.timezone))
    ) {
      return { error: t("errors.rewardField.endsAt") }
    }
    const checked = checkRewardRule(
      { ...rest, endsAt: null },
      new Set(services.map((service) => service.id)),
      BOOKING_RULES.maxPriceMinor
    )
    if (!checked.ok) {
      return { error: t(`errors.rewardField.${checked.error}`) }
    }
    const { endsAt, ...values } = checked.values
    void endsAt
    const named = (ids: string[] | null) =>
      ids === null
        ? null
        : services
            .filter((service) => ids.includes(service.id))
            .map(({ id, name }) => ({ id, name }))
    const say = rewardWords(words.rewards, locale, business.currency)
    return {
      ruleId: current?.id ?? null,
      form: { ...values, endsOn },
      summary: [
        say.prize({ ...values, rewardServices: named(values.rewardServiceIds) }),
        say.earn({ ...values, earnServices: named(values.earnServiceIds) }),
        ...rewardLimits(values, endsOn, business.currency),
      ].join(" · "),
    }
  }
  // Shared checks for adjust_customer_visits: the rule, the customer and
  // how much, with the reason every change by hand carries.
  const checkAdjustArgs = async (args: unknown) => {
    const found = await rewardRule(args)
    if ("error" in found) return found
    const a = asRecord(args) ?? {}
    if (typeof a.customerKey !== "string" || a.customerKey === "") {
      return { error: t("errors.rewardCustomer") }
    }
    const customer = (await getCustomers(businessId)).find(
      (item) => item.key === a.customerKey
    )
    if (!customer) return { error: t("errors.rewardCustomer") }
    const { rule, settings } = found
    const most =
      rule.earnType === "visit"
        ? REWARD_RULES.maxAdjust
        : rule.goal * REWARD_RULES.maxCount
    const amount = a.amount
    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount === 0 ||
      Math.abs(amount) > most
    ) {
      return { error: t("errors.rewardAmount", { max: String(most) }) }
    }
    const reason = validName(a.reason, REWARD_RULES.maxNote)
    if (!reason) {
      return {
        error: t("errors.rewardReason", { max: String(REWARD_RULES.maxNote) }),
      }
    }
    const size =
      rule.earnType === "visit"
        ? t("reward.visits", { count: Math.abs(amount) })
        : formatPrice(Math.abs(amount), settings.currency, locale)
    return {
      change: { ruleId: rule.id, customerKey: customer.key, amount, note: reason },
      adding: amount > 0,
      summary: [
        customer.name,
        t(`reward.${amount > 0 ? "plus" : "minus"}`, { size }),
        rewardWords(words.rewards, locale, settings.currency).prize(rule),
        reason,
      ].join(" · "),
    }
  }
  // Shared checks for save_payment_method: a new way (no methodId), or one
  // of the business's with what changes; the rest is kept.
  const checkPaymentMethodArgs = async (
    args: unknown
  ): Promise<
    | {
        methodId: string | null
        values: { type: string; name: string; details: string }
      }
    | { error: string }
  > => {
    const a = asRecord(args) ?? {}
    const { methods } = await getPaymentSettings(businessId)
    let current: (typeof methods)[number] | null = null
    if (a.methodId !== undefined) {
      current = methods.find((method) => method.id === a.methodId) ?? null
      if (!current) {
        return { error: t("errors.paymentMethodUnknown") }
      }
    } else if (methods.length >= PAYMENT_RULES.maxMethods) {
      return {
        error: t("errors.paymentMethodsFull", {
          max: String(PAYMENT_RULES.maxMethods),
        }),
      }
    }
    const text = (key: string, kept: string | undefined) =>
      typeof a[key] === "string" ? (a[key] as string) : (kept ?? "")
    const values = {
      type: text("type", current?.type),
      // A brand (Zelle, Cash App) is its own name when none is given.
      name: text(
        "name",
        current?.name ??
          PAYMENT_START_NAMES[a.type as PaymentType] ??
          undefined
      ),
      details: text("details", current?.details),
    }
    const checked = checkPaymentMethod(values)
    if (!checked.ok) {
      return { error: t(`errors.paymentMethod.${checked.error}`) }
    }
    if (
      current &&
      current.type === checked.values.type &&
      current.name === checked.values.name &&
      current.details === checked.values.details
    ) {
      return { error: t("errors.nothingToChange") }
    }
    return { methodId: current?.id ?? null, values: checked.values }
  }
  // Shared checks for save_policy. kind: a standard policy, added or
  // replaced. No kind: the owner's own, a new one (title needed) or, with
  // policyId, one of theirs (title kept when not given). current: the
  // policy being changed, null when adding.
  const checkPolicyArgs = async (
    args: unknown
  ): Promise<
    | {
        kind: (typeof POLICY_KINDS)[number] | null
        current: OwnerPolicy | null
        title: string | null
        body: string
      }
    | { error: string }
  > => {
    const a = asRecord(args) ?? {}
    const body = typeof a.body === "string" ? a.body.trim() : ""
    if (body === "") {
      return { error: t("errors.policyBodyRequired") }
    }
    if (body.length > POLICY_RULES.maxLength) {
      return { error: t("errors.policyTooLong", { max: String(POLICY_RULES.maxLength) }) }
    }
    const { policies } = await getPolicies(businessId)
    const full = policies.length >= POLICY_RULES.maxPolicies
    if (a.kind !== undefined && a.kind !== null && a.kind !== "") {
      if (!isPolicyKind(a.kind)) {
        return { error: t("errors.policyKindInvalid") }
      }
      const current = policies.find((policy) => policy.kind === a.kind) ?? null
      if (!current && full) {
        return { error: t("errors.policiesFull", { max: String(POLICY_RULES.maxPolicies) }) }
      }
      return { kind: a.kind, current, title: null, body }
    }
    let current: OwnerPolicy | null = null
    if (typeof a.policyId === "string" && a.policyId !== "") {
      current =
        policies.find(
          (policy) => policy.id === a.policyId && policy.kind === null
        ) ?? null
      if (!current) {
        return { error: t("errors.policyUnknown") }
      }
    } else if (full) {
      return { error: t("errors.policiesFull", { max: String(POLICY_RULES.maxPolicies) }) }
    }
    const title =
      typeof a.title === "string" && a.title.trim() !== ""
        ? a.title.trim()
        : (current?.title ?? "")
    if (title === "") {
      return { error: t("errors.policyTitleRequired") }
    }
    if (title.length > POLICY_RULES.maxTitle) {
      return { error: t("errors.policyTitleTooLong", { max: String(POLICY_RULES.maxTitle) }) }
    }
    return { kind: null, current, title, body }
  }
  // A policy's name for a confirm card: a standard one's in the owner
  // area's words, the owner's own by its title.
  const policyName = (policy: Pick<OwnerPolicy, "kind" | "title">) =>
    policy.kind
      ? ownerT(`settings.policies.kinds.${policy.kind}`)
      : (policy.title ?? "")
  // Shared checks for save_policy_point: no pointId adds one; with one, only
  // the given fields change.
  const checkPolicyPointArgs = async (
    args: unknown
  ): Promise<
    | { current: OwnerPolicyPoint | null; input: PolicyPointInput }
    | { error: string }
  > => {
    const a = asRecord(args)
    if (!a) {
      return { error: t("errors.pointIdRequired") }
    }
    const { points } = await getPolicies(businessId)
    const adding = a.pointId === undefined || a.pointId === null
    const current = adding ? null : points.find((p) => p.id === a.pointId)
    if (current === undefined) {
      return { error: t("errors.pointUnknown") }
    }
    if (current === null && points.length >= POLICY_RULES.maxPoints) {
      return { error: t("errors.pointsFull", { max: String(POLICY_RULES.maxPoints) }) }
    }
    const icon = a.icon === undefined ? current?.icon : a.icon
    if (!isPolicyPointIcon(icon)) {
      return {
        error: t("errors.pointIconInvalid", { icons: POLICY_POINT_ICONS.join(", ") }),
      }
    }
    const title =
      a.title === undefined && current
        ? current.title
        : validName(a.title, POLICY_RULES.maxPointTitle)
    if (!title) {
      return { error: t("errors.pointTitleInvalid", { max: String(POLICY_RULES.maxPointTitle) }) }
    }
    const body =
      a.body === undefined && current
        ? current.body
        : validName(a.body, POLICY_RULES.maxPointBody)
    if (!body) {
      return { error: t("errors.pointBodyInvalid", { max: String(POLICY_RULES.maxPointBody) }) }
    }
    if (
      current &&
      current.icon === icon &&
      current.title === title &&
      current.body === body
    ) {
      return { error: t("errors.nothingToChange") }
    }
    return { current, input: { icon, title, body } }
  }
  // Shared checks for turn_message_on_off.
  const checkMessageOnArgs = async (
    args: unknown
  ): Promise<{ message: BookingMessage; on: boolean } | { error: string }> => {
    const a = asRecord(args)
    if (!a || !BOOKING_MESSAGES.includes(a.message as BookingMessage)) {
      return { error: t("errors.messageUnknown") }
    }
    if (typeof a.on !== "boolean") {
      return { error: t("errors.onInvalid") }
    }
    const message = a.message as BookingMessage
    const { turnedOff } = await notificationSettingsFor(businessId)
    return turnedOff.includes(message) !== a.on
      ? { error: t("errors.nothingToChange") }
      : { message, on: a.on }
  }
  // Shared checks for turn_email_on_off (docs/plans/email.md, EM-12).
  const checkEmailOnArgs = async (
    args: unknown
  ): Promise<{ email: BookingEmail; on: boolean } | { error: string }> => {
    const a = asRecord(args)
    if (!a || !isBookingEmail(a.email)) {
      return { error: t("errors.emailUnknown") }
    }
    if (typeof a.on !== "boolean") {
      return { error: t("errors.onInvalid") }
    }
    const { emailTurnedOff } = await notificationSettingsFor(businessId)
    return emailTurnedOff.includes(a.email) !== a.on
      ? { error: t("errors.nothingToChange") }
      : { email: a.email, on: a.on }
  }
  // Shared checks for save_reminder_settings: the action saves these fields
  // together, so the given ones go over what is saved now, re-read at the tap.
  const checkReminderSettingsArgs = async (
    args: unknown
  ): Promise<
    | {
        current: NotificationSettings
        next: Omit<NotificationSettings, "turnedOff" | "emailTurnedOff">
      }
    | { error: string }
  > => {
    const a = asRecord(args)
    if (!a) {
      return { error: t("errors.nothingToChange") }
    }
    const [current, rules] = await Promise.all([
      notificationSettingsFor(businessId),
      notificationRules(businessId),
    ])
    const phoneRaw = a.ownerPhone === undefined ? current.ownerPhone : a.ownerPhone
    if (phoneRaw !== null && typeof phoneRaw !== "string") {
      return { error: t("errors.phoneInvalid") }
    }
    const ownerPhone = phoneRaw?.trim() || null
    if (ownerPhone !== null && !PHONE_PATTERN.test(ownerPhone)) {
      return { error: t("errors.phoneInvalid") }
    }
    const ownerLanguage =
      a.ownerLanguage === undefined ? current.ownerLanguage : a.ownerLanguage
    if (!TEMPLATE_LANGUAGES.includes(ownerLanguage as TemplateLanguage)) {
      return {
        error: t("errors.languageInvalid", {
          languages: TEMPLATE_LANGUAGES.join(", "),
        }),
      }
    }
    const remindersRaw = a.reminders === undefined ? current.reminders : a.reminders
    const reminders = Array.isArray(remindersRaw)
      ? [...new Set(remindersRaw as number[])].sort((x, y) => y - x)
      : null
    if (
      !reminders ||
      reminders.length > rules.maxReminders ||
      reminders.some((minutes) => !rules.reminderChoices.includes(minutes))
    ) {
      return {
        error: t("errors.remindersInvalid", { max: String(rules.maxReminders), choices: rules.reminderChoices.join(", ") }),
      }
    }
    const quietStart = a.quietStart === undefined ? current.quietStart : a.quietStart
    const quietEnd = a.quietEnd === undefined ? current.quietEnd : a.quietEnd
    if (
      typeof quietStart !== "string" ||
      !TIME_RE.test(quietStart) ||
      typeof quietEnd !== "string" ||
      !TIME_RE.test(quietEnd)
    ) {
      return { error: t("errors.quietInvalid") }
    }
    const freeTextInWindow = flagOr(a.freeTextInWindow, current.freeTextInWindow)
    if (freeTextInWindow === null) {
      return { error: t("errors.settingInvalid", { field: "freeTextInWindow" }) }
    }
    const thankYouReply = flagOr(a.thankYouReply, current.thankYouReply)
    if (thankYouReply === null) {
      return { error: t("errors.settingInvalid", { field: "thankYouReply" }) }
    }
    const cantCome = a.cantCome === undefined ? current.cantCome : a.cantCome
    if (cantCome !== "cancel" && cantCome !== "alertOnly") {
      return { error: t("errors.settingInvalid", { field: "cantCome" }) }
    }
    const next: Omit<NotificationSettings, "turnedOff" | "emailTurnedOff"> = {
      ownerPhone,
      ownerLanguage: ownerLanguage as TemplateLanguage,
      reminders,
      quietStart,
      quietEnd,
      freeTextInWindow,
      cantCome: cantCome as CantComeAction,
      thankYouReply,
    }
    return { current, next }
  }
  // Shared checks for change_message_wording. Given parts go over the wording
  // saved now, and the buttons stay: the action's null means Book's default
  // buttons, which would replace the owner's own. Koblip's number has fixed
  // wording, so a change there would be saved and never sent.
  const checkWordingArgs = async (
    args: unknown
  ): Promise<
    | {
        item: NotificationMessage
        language: TemplateLanguage
        wording: Wording | null
        buttons: MessageButton[] | null
        // Book's own buttons in this language.
        defaults: MessageButton[]
      }
    | { error: string }
  > => {
    const a = asRecord(args)
    if (!a || !BOOKING_MESSAGES.includes(a.message as BookingMessage)) {
      return { error: t("errors.messageUnknown") }
    }
    if (!TEMPLATE_LANGUAGES.includes(a.language as TemplateLanguage)) {
      return {
        error: t("errors.languageInvalid", {
          languages: TEMPLATE_LANGUAGES.join(", "),
        }),
      }
    }
    const message = a.message as BookingMessage
    const language = a.language as TemplateLanguage
    const items = await notificationMessagesFor(businessId)
    const item = items.find((row) => row.message === message)
    if (!item) {
      return { error: t("errors.messageUnknown") }
    }
    if (!item.editable) {
      return { error: t("errors.wordingLocked") }
    }
    const text = item.texts[language]
    const defaults = defaultButtons(message, await bookWordsFor(language))
    if (a.useDefault === true) {
      return text.isDefault
        ? { error: t("errors.nothingToChange") }
        : { item, language, wording: null, buttons: null, defaults }
    }
    const part = (value: unknown, saved: string): string | null =>
      value === undefined ? saved : typeof value === "string" ? value.trim() : null
    const header = part(a.header, text.wording.header)
    const body = part(a.body, text.wording.body)
    const footer = part(a.footer, text.wording.footer)
    if (header === null || body === null || footer === null) {
      return { error: t("errors.wordingInvalid") }
    }
    const wording: Wording = { header, body, footer }
    let buttons: MessageButton[] | null
    if (a.buttons === undefined) {
      buttons =
        JSON.stringify(text.buttons) === JSON.stringify(defaults)
          ? null
          : text.buttons
    } else {
      const rows = Array.isArray(a.buttons) ? a.buttons.map(asRecord) : null
      if (
        !rows ||
        rows.some(
          (row) =>
            !row || typeof row.action !== "string" || typeof row.label !== "string"
        )
      ) {
        return { error: t("errors.buttonsInvalid") }
      }
      buttons = (rows as Record<string, string>[]).map((row) => ({
        action: row.action as MessageButton["action"],
        label: row.label.trim(),
      }))
    }
    const problem =
      wordingProblem(message, wording) ??
      (buttons && buttonsProblem(message, buttons))
    if (problem) {
      return {
        error: t("errors.wordingProblem", { reason: t(`errors.wordingProblems.${problem}`), fields: messageFields(message)
            .map((field) => `{${field}}`)
            .join(", ") }),
      }
    }
    if (
      JSON.stringify(wording) === JSON.stringify(text.wording) &&
      JSON.stringify(buttons ?? defaults) === JSON.stringify(text.buttons)
    ) {
      return { error: t("errors.nothingToChange") }
    }
    return { item, language, wording, buttons, defaults }
  }
  // Shared checks for turn_automation_on_off.
  const checkAutomationArgs = async (
    args: unknown
  ): Promise<{ automation: Automation; on: boolean } | { error: string }> => {
    const a = asRecord(args)
    if (!a || typeof a.automationId !== "string" || a.automationId === "") {
      return { error: t("errors.automationIdRequired") }
    }
    if (typeof a.on !== "boolean") {
      return { error: t("errors.onInvalid") }
    }
    const automations = await automationsFor(businessId)
    const automation = automations.find((row) => row.id === a.automationId)
    if (!automation) {
      return { error: t("errors.automationUnknown") }
    }
    return automation.on === a.on
      ? { error: t("errors.nothingToChange") }
      : { automation, on: a.on }
  }
  // One whole list in a new order. The card shows the names in that order;
  // the action checks the ids again at the tap.
  const reorderTool = (config: {
    name: string
    argument: string
    listTool: string
    things: string
    resultKind: ResultKind
    label: string
    doneLabel: string
    tapFirst: string
    title: string
    doneText: string
    list: () => Promise<{ id: string; name: string }[]>
    save: (ids: string[]) => Promise<{ ok: true } | { ok: false; error: string }>
  }): AssistantTool => ({
    definition: {
      name: config.name,
      description: `Put all ${config.things} in a new order. Pass every id from ${config.listTool} once, in the new order. Needs the owner's tap.`,
      parameters: schema(
        {
          [config.argument]: {
            type: "array",
            description: `Every id from ${config.listTool}, in the new order`,
            items: { type: "string" },
          },
        },
        [config.argument]
      ),
      needsConfirm: true,
      resultKind: config.resultKind,
    },
    label: config.label,
    doneLabel: config.doneLabel,
    run: async () => ({ error: config.tapFirst }),
    confirm: {
      describe: async (args: unknown) => {
        const rows = await config.list()
        const current = rows.map((row) => row.id)
        const ids = newOrder(asRecord(args)?.[config.argument], current)
        if (!ids) {
          return { error: t("errors.orderInvalid", { source: config.listTool }) }
        }
        if (ids.join() === current.join()) {
          return { error: t("errors.nothingToChange") }
        }
        return {
          title: config.title,
          action: t("actions.reorder"),
          summary: ids
            .map((id) => rows.find((row) => row.id === id)!.name)
            .join(", "),
          destructive: false,
        }
      },
      execute: async (args: unknown) => {
        const ids = asRecord(args)?.[config.argument]
        const result = await config.save(ids as string[])
        return result.ok
          ? { ok: true, doneText: config.doneText }
          : { ok: false, doneText: t("reorder.failed", { error: result.error }) }
      },
    },
  })
  return [
    {
      definition: {
        name: "business_overview",
        description:
          "Name, address, phone, hours, booking counts, about, website, category, seats, bookingPath and photoCount. paymentsToCheck (only when the business lists ways to pay): bookings whose customer says they paid and the owner has not checked yet. rewardsWaiting (only when the business runs rewards): rewards customers earned and have not redeemed yet.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t("steps.overview"),
      doneLabel: t("stepsDone.overview"),
      run: async () => {
        const [{ business, hours }, counts, photos, payments, rewards] =
          await Promise.all([
            getOwnerBusiness(businessId),
            getBookingCounts(businessId),
            getBusinessPhotos(businessId),
            getPaymentSettings(businessId),
            getRewardSettings(businessId),
          ])
        return {
          name: business.name,
          address: business.address,
          phone: business.phone,
          timezone: business.timezone,
          currency: business.currency,
          hours: hoursText(locale, hours),
          todayBookings: counts.today,
          upcomingBookings: counts.upcoming,
          about: business.description,
          website: business.website,
          category: business.category,
          seats: business.seats,
          bookingPath: `/b/${business.slug}`,
          photoCount: photos.length,
          // Only for a business that lists ways to be paid outside the app.
          ...(payments.methods.length > 0
            ? { paymentsToCheck: payments.toCheck }
            : {}),
          // Only for a business that runs rewards.
          ...(rewards.rules.length > 0
            ? { rewardsWaiting: rewards.counts.waiting }
            : {}),
        }
      },
    },
    {
      definition: {
        name: "list_services",
        description:
          "All services in the order shown, by category, with categoryId and categoryName (null = Other), duration, price, description, photo yes/no, team member ids and add-on group ids; categories are the service categories in order. reorder_services orders services within their category; update_service's categoryId moves one.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t("steps.services"),
      doneLabel: t("stepsDone.services"),
      run: async () => {
        const [owned, teams, groups] = await Promise.all([
          getOwnerBusiness(businessId),
          getServiceTeams(businessId),
          getAddonGroups(businessId),
        ])
        const { business, categories } = owned
        const rows = servicesInShownOrder(owned).map((s) => {
          // Null for Other, like the shared grouping.
          const category = categories.find((c) => c.id === s.categoryId)
          return {
            id: s.id,
            name: s.name,
            categoryId: category?.id ?? null,
            categoryName: category?.name ?? null,
            durationMinutes: s.durationMinutes,
            priceMinor: s.priceMinor,
            priceText: priceText(t, locale, s.priceMinor, business.currency),
            description: s.description,
            hasPhoto: s.photoUrl !== null,
            teamMemberIds: teams[s.id] ?? [],
            addonGroupIds: groups
              .filter((g) => g.serviceIds.includes(s.id))
              .map((g) => g.id),
          }
        })
        const capped = rows.slice(0, 50)
        return {
          services: capped,
          categories: categories.map((c) => ({ id: c.id, name: c.name })),
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
      label: t("steps.addons"),
      doneLabel: t("stepsDone.addons"),
      run: async () => {
        const [groups, { business }] = await Promise.all([
          getAddonGroups(businessId),
          getOwnerBusiness(businessId),
        ])
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
            priceText: priceText(t, locale, o.priceMinor, business.currency),
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
        description:
          "All team members with photo yes/no, service ids and working hours. No custom hours means business hours; custom hours are restricted to business hours.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t("steps.team"),
      doneLabel: t("stepsDone.team"),
      run: async () => {
        const [{ team, memberHours }, teams] = await Promise.all([
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
          hours: hoursText(
            locale,
            memberHours.filter((row) => row.teamMemberId === m.id)
          ),
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
          "Bookings, each with when (past / now / upcoming), team member, length, price, source, note and add-ons. rewardOffMinor / rewardOffText: what a redeemed reward took off (the price is already what is to pay). A booking paid outside the app also has payment: choice (now, or later = at the visit), way, status (unpaid, reported = the customer says they paid and the owner must check, paid = the owner confirmed), reference and hasProof (the customer added a picture of the payment; you cannot see it, the owner opens it on the booking). A booking paid online by card has way Card with paidOnlineMinor / paidOnlineText (what the card paid when booking: a deposit or the full price; the rest of the price is paid at the visit) and refundedMinor (what was given back); only Stripe sets these. For yesterday, today or tomorrow, pass only day: every booking that day, past and upcoming (count them all for 'how many today'). For other days, from/to: every booking on those days; adding range keeps only that side of now. With none of these: upcoming (soonest first) or past (most recent first). Source caps: next 200 upcoming, last 100 past.",
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
          payment: {
            type: "string",
            enum: [...PAYMENT_STATUSES],
            description:
              "Only bookings whose payment is unpaid, reported (the customer says they paid; the owner has not checked) or paid",
          },
        }),
        needsConfirm: false,
      },
      label: t("steps.bookings"),
      doneLabel: t("stepsDone.bookings"),
      run: async (args: unknown) => {
        const a = { ...((args ?? {}) as Record<string, unknown>) }
        if (a.day !== undefined) {
          if (!Object.hasOwn(DAY_OFFSETS, a.day as string)) {
            return bad(t("errors.dayChoiceInvalid"))
          }
          if (
            a.from !== undefined ||
            a.to !== undefined ||
            a.range !== undefined
          ) {
            return bad(t("errors.dayAlone"))
          }
          const { business } = await getOwnerBusiness(businessId)
          a.from = a.to = addDaysStr(
            zonedToday(Date.now(), business.timezone),
            DAY_OFFSETS[a.day as keyof typeof DAY_OFFSETS]
          )
        }
        const range = a.range ?? "upcoming"
        if (range !== "upcoming" && range !== "past") {
          return bad(t("errors.rangeInvalid"))
        }
        for (const key of ["from", "to"] as const) {
          if (
            a[key] !== undefined &&
            (typeof a[key] !== "string" || !DATE_RE.test(a[key]))
          ) {
            return bad(t("errors.dayInvalid", { key }))
          }
        }
        if (
          a.status !== undefined &&
          !STATUSES.includes(a.status as (typeof STATUSES)[number])
        ) {
          return bad(t("errors.statusUnknown"))
        }
        if (
          a.payment !== undefined &&
          !(PAYMENT_STATUSES as readonly unknown[]).includes(a.payment)
        ) {
          return bad(t("errors.paymentStatusUnknown"))
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
            (a.payment === undefined || b.payment?.status === a.payment) &&
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
          dayText: formatDay(b.date, locale),
          timeText: formatClock(b.time, locale),
          endTimeText: formatClock(b.endTime, locale),
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
          priceText: priceText(t, locale, b.priceMinor, b.currency),
          source: b.source,
          note: b.note,
          // Paying outside the app; absent when the booking tracks none.
          // "reported" is the customer's word only, never paid.
          ...(b.payment
            ? {
                payment: {
                  // "later": they pay at the visit, with no way chosen.
                  choice: b.payment.choice,
                  way:
                    b.payment.method?.type === CARD_TYPE
                      ? t("onlinePayment.card")
                      : (b.payment.method?.name ?? null),
                  status: b.payment.status,
                  reference: b.payment.reference,
                  // Whether the customer added a picture of the payment.
                  // The picture itself never comes here: the owner opens
                  // it on the booking.
                  hasProof: b.payment.hasProof,
                  // By card, online: what was paid when booking and
                  // what the owner gave back. Absent when not by card.
                  ...(b.payment.online
                    ? {
                        paidOnlineMinor: b.payment.online.paidMinor,
                        paidOnlineText: formatPrice(
                          b.payment.online.paidMinor,
                          b.currency,
                          locale
                        ),
                        refundedMinor: b.payment.online.refundedMinor,
                      }
                    : {}),
                },
              }
            : {}),
          // What a redeemed reward took off; priceMinor is already what
          // is to pay. Absent when no reward was used.
          ...(b.rewardDiscountMinor
            ? {
                rewardOffMinor: b.rewardDiscountMinor,
                rewardOffText: formatPrice(
                  b.rewardDiscountMinor,
                  b.currency,
                  locale
                ),
              }
            : {}),
          addons: b.addons.map((a) => ({
            name: a.name,
            priceMinor: a.priceMinor,
            priceText: priceText(t, locale, a.priceMinor, b.currency),
            durationMinutes: a.durationMinutes,
          })),
        }))
        return {
          // The date a plain day stood for, so the answer can name it.
          ...(a.day !== undefined
            ? { date: a.from, dayText: dayText(locale, a.from as string) }
            : {}),
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
      label: t("steps.customer"),
      doneLabel: t("stepsDone.customer"),
      run: async (args: unknown) => {
        const query = (args as Record<string, unknown> | null)?.query
        if (
          typeof query !== "string" ||
          query.trim().length === 0 ||
          query.length > ASSISTANT_RULES.maxCustomerQuery
        ) {
          return bad(t("errors.queryInvalid", { max: String(ASSISTANT_RULES.maxCustomerQuery) }))
        }
        const matched = customersMatching(
          await getCustomers(businessId),
          query
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
              lastVisitText: dayText(locale, c.lastVisit),
              nextBookingText: dayText(locale, c.nextBooking),
              firstBookingText: dayText(locale, c.firstBooking),
              spentMinor: c.spentMinor,
              spentText: formatPrice(c.spentMinor, c.currency, locale),
              recent: recent.slice(0, 3).map((b) => ({
                date: b.date,
                time: b.time,
                dayText: formatDay(b.date, locale),
                timeText: formatClock(b.time, locale),
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
      label: t("steps.stats"),
      doneLabel: t("stepsDone.stats"),
      run: async (args: unknown) => {
        const a = asRecord(args) ?? {}
        if (typeof a.from !== "string" || !isRealDate(a.from)) {
          return bad(t("errors.dayInvalid", { key: "from" }))
        }
        if (typeof a.to !== "string" || !isRealDate(a.to) || a.to < a.from) {
          return bad(t("errors.toInvalid"))
        }
        if (daysInRange(a.from, a.to) > ASSISTANT_RULES.maxStatsRangeDays) {
          return bad(t("errors.rangeTooLong", { max: String(ASSISTANT_RULES.maxStatsRangeDays) }))
        }
        const [rows, { business }] = await Promise.all([
          getBookingsBetween(businessId, a.from, a.to),
          getOwnerBusiness(businessId),
        ])
        const now = new Date().toISOString()
        const stats = bookingStats(rows, now, business.currency)
        return {
          ...stats,
          earnedText: formatPrice(stats.earnedMinor, stats.currency, locale),
          expectedText: formatPrice(stats.expectedMinor, stats.currency, locale),
          byWeekday: stats.byWeekday.map((row) => ({
            ...row,
            weekdayText: formatWeekday(row.weekday, locale),
          })),
          byHour: stats.byHour.map((row) => ({
            ...row,
            hourText: formatClock(`${row.hour}:00`, locale),
          })),
          from: a.from,
          to: a.to,
          fromText: formatDay(a.from, locale),
          toText: formatDay(a.to, locale),
        }
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
      label: t("steps.customers"),
      doneLabel: t("stepsDone.customers"),
      run: async (args: unknown) => {
        const a = asRecord(args) ?? {}
        const sorts = [
          "bookings",
          "spent",
          "lastVisit",
          "firstBooking",
        ] as const
        const sort = a.sort === undefined ? ("lastVisit" as const) : a.sort
        if (!sorts.includes(sort as (typeof sorts)[number])) {
          return bad(t("errors.sortInvalid"))
        }
        if (
          a.newSince !== undefined &&
          (typeof a.newSince !== "string" || !isRealDate(a.newSince))
        ) {
          return bad(t("errors.dayInvalid", { key: "newSince" }))
        }
        const newSince = typeof a.newSince === "string" ? a.newSince : undefined
        const all = await getCustomers(businessId)
        const filtered =
          newSince === undefined
            ? all
            : all.filter(
                (c) => c.firstBooking !== null && c.firstBooking >= newSince
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
          firstBookingText: dayText(locale, c.firstBooking),
          lastVisitText: dayText(locale, c.lastVisit),
          nextBookingText: dayText(locale, c.nextBooking),
          spentMinor: c.spentMinor,
          currency: c.currency,
          spentText: formatPrice(c.spentMinor, c.currency, locale),
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
          "Create a service. Price is in minor units of the business currency (null = no price). Needs the owner's tap.",
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
            categoryId: {
              type: "string",
              description:
                'Optional: an id from list_services categories, or "none" for no category',
            },
          },
          ["name", "minutes", "priceMinor"]
        ),
        needsConfirm: true,
        resultKind: "services",
      },
      label: t("steps.createService"),
      doneLabel: t("stepsDone.createService"),
      run: async () => ({ error: t("tapFirst.createService") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = checkCreateServiceArgs(args)
          if ("error" in checked) {
            return checked
          }
          const { business, services, categories } =
            await getOwnerBusiness(businessId)
          const category = pickCategory(asRecord(args)?.categoryId, categories)
          if (category === "unknown") {
            return { error: t("errors.serviceCategoryInvalid") }
          }
          if (services.length >= BOOKING_RULES.maxServices) {
            return { error: t("errors.servicesFull", { max: String(BOOKING_RULES.maxServices) }) }
          }
          if (services.some((service) => sameService(service, checked))) {
            return { error: t("errors.serviceExists", { name: checked.name }) }
          }
          return {
            title: t("cards.createService"),
            action: t("actions.createService"),
            summary: [
              checked.name,
              t("booking.minutes", { durationMinutes: String(checked.durationMinutes) }),
              priceText(t, locale, checked.priceMinor, business.currency),
              ...(category ? [category.name] : []),
              ...(checked.description ? [checked.description] : []),
            ].join(" · "),
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = checkCreateServiceArgs(args)
          if ("error" in checked) {
            return {
              ok: false,
              doneText: t("createService.failed", { error: checked.error }),
            }
          }
          // Two cards can wait for the same service, or one come after another
          // was tapped; the card's own check is from when it was made.
          const { services, categories } = await getOwnerBusiness(businessId)
          if (services.some((service) => sameService(service, checked))) {
            return {
              ok: false,
              doneText: t("createService.failed", { error: t("errors.serviceExists", { name: checked.name }) }),
            }
          }
          // A category removed since the card showed is refused, never
          // swapped for no category.
          const category = pickCategory(asRecord(args)?.categoryId, categories)
          if (category === "unknown") {
            return {
              ok: false,
              doneText: t("createService.failed", { error: t("errors.serviceCategoryInvalid") }),
            }
          }
          const result = await createService(
            businessId,
            category === undefined
              ? checked
              : { ...checked, categoryId: category?.id ?? null }
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("createService.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("createService.done", { name: checked.name }) }
        },
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
          categoryId: {
            type: "string",
            description:
              'New category: an id from list_services categories, or "none" for no category',
          },
        }),
        needsConfirm: true,
        resultKind: "services",
      },
      label: t("steps.updateService"),
      doneLabel: t("stepsDone.updateService"),
      run: async () => ({ error: t("tapFirst.updateService") }),
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
              `${priceText(t, locale, checked.current.priceMinor, checked.currency)} → ${priceText(t, locale, checked.priceMinor, checked.currency)}`
            )
          }
          if (checked.durationMinutes !== checked.current.durationMinutes) {
            parts.push(
              `${t("booking.minutes", { durationMinutes: String(checked.current.durationMinutes) })} → ${t("booking.minutes", { durationMinutes: String(checked.durationMinutes) })}`
            )
          }
          const oldDescription = checked.current.description ?? null
          const newDescription = checked.description ?? null
          if (oldDescription !== newDescription) {
            parts.push(`${oldDescription ?? ""} → ${newDescription ?? ""}`)
          }
          if (
            checked.category !== undefined &&
            checked.category?.id !== checked.currentCategory?.id
          ) {
            const categoryName = (category: CategoryRow | null) =>
              category?.name ?? ownerT("catalog.categories.none")
            parts.push(
              `${categoryName(checked.currentCategory)} → ${categoryName(checked.category)}`
            )
          }
          if (parts.length === 0) {
            return { error: t("errors.nothingToChange") }
          }
          return {
            title: t("cards.updateService"),
            action: t("actions.updateService"),
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
              checked.error === t("errors.serviceUnknown") ||
              checked.error === t("errors.serviceIdRequired")
            ) {
              return { ok: false, doneText: t("updateService.unknown") }
            }
            return {
              ok: false,
              doneText: t("updateService.failed", { error: checked.error }),
            }
          }
          const result = await updateService(businessId, checked.current.id, {
            name: checked.name,
            description: checked.description,
            durationMinutes: checked.durationMinutes,
            priceMinor: checked.priceMinor,
            // Left out keeps the service's category.
            ...(checked.category !== undefined
              ? { categoryId: checked.category?.id ?? null }
              : {}),
          })
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("updateService.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("updateService.done") }
        },
      },
    },
    {
      definition: {
        name: "rename_team_member",
        description:
          "Rename a team member. Use the id from list_team. Needs the owner's tap.",
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
        needsConfirm: true,
        resultKind: "team",
      },
      label: t("steps.renameMember"),
      doneLabel: t("stepsDone.renameMember"),
      run: async () => ({ error: t("tapFirst.renameMember") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkRenameArgs(args)
          if ("error" in checked) {
            return checked
          }
          return {
            title: t("cards.renameMember"),
            action: t("actions.renameMember"),
            summary: `${checked.member.name} → ${checked.name}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkRenameArgs(args)
          if ("error" in checked) {
            return {
              ok: false,
              doneText:
                checked.error === t("errors.memberUnknown") ||
                checked.error === t("errors.memberIdRequired")
                  ? t("renameMember.unknown")
                  : t("renameMember.failed", { error: checked.error }),
            }
          }
          const result = await renameTeamMember(
            businessId,
            checked.member.id,
            checked.name
          )
          if (!result.ok) {
            return { ok: false, doneText: t("renameMember.failed", { error: result.error }) }
          }
          return { ok: true, doneText: t("renameMember.done", { name: checked.name }) }
        },
      },
    },
    {
      definition: {
        name: "set_booking_status",
        description:
          "Mark a booking confirmed, completed or no_show. Use the id from list_bookings. Cannot cancel. Needs the owner's tap.",
        parameters: schema(
          {
            bookingId: { type: "string", description: "Id from list_bookings" },
            status: { type: "string", enum: [...SETTABLE_STATUSES] },
          },
          ["bookingId", "status"]
        ),
        needsConfirm: true,
        resultKind: "bookings",
      },
      label: t("steps.setBookingStatus"),
      doneLabel: t("stepsDone.setBookingStatus"),
      run: async () => ({ error: t("tapFirst.bookingStatus") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkBookingStatusArgs(args)
          if ("error" in checked) {
            return checked
          }
          const { booking, status } = checked
          return {
            title: t(`cards.bookingStatus.${status}`),
            action: t(`actions.bookingStatus.${status}`),
            summary: `${booking.customerName} · ${booking.serviceName} · ${formatDay(booking.date, locale)} · ${formatClock(booking.time, locale)}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const a = asRecord(args)
          const status = settableStatus(a?.status)
          if (
            !a ||
            typeof a.bookingId !== "string" ||
            a.bookingId === "" ||
            !status
          ) {
            return { ok: false, doneText: t("bookingStatus.unknown") }
          }
          const result = await setBookingStatus(businessId, a.bookingId, status)
          if (!result.ok) {
            const refusals: Record<string, string> = {
              not_found: t("bookingStatus.unknown"),
              cancelled: t("bookingStatus.cancelled"),
              not_started: t("bookingStatus.notStarted"),
            }
            return {
              ok: false,
              doneText:
                refusals[result.error] ?? t("bookingStatus.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t(`bookingStatus.done.${status}`) }
        },
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
      label: t("steps.cancelBooking"),
      doneLabel: t("stepsDone.cancelBooking"),
      run: async () => ({ error: t("tapFirst.cancel") }),
      confirm: {
        describe: async (args: unknown) => {
          const a = asRecord(args)
          if (!a || typeof a.bookingId !== "string" || a.bookingId === "") {
            return { error: t("errors.bookingIdRequired") }
          }
          const found = await cancellableBooking(a.bookingId)
          if (found === "unknown") {
            return { error: t("errors.bookingUnknown") }
          }
          if (found === "cancelled") {
            return { error: t("errors.bookingCancelled") }
          }
          if (found === "started") {
            return { error: t("errors.bookingStarted") }
          }
          const booking = found
          return {
            title: t("cards.cancel"),
            action: t("actions.cancelBooking"),
            summary: `${booking.customerName} · ${booking.serviceName} · ${formatDay(booking.date, locale)} · ${formatClock(booking.time, locale)}`,
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const a = asRecord(args)
          const bookingId = a?.bookingId
          if (typeof bookingId !== "string" || bookingId === "") {
            return { ok: false, doneText: t("cancel.unknown") }
          }
          // Checked again at the tap: it may have started or been
          // cancelled since the card showed.
          const found = await cancellableBooking(bookingId)
          if (found === "unknown") {
            return { ok: false, doneText: t("cancel.unknown") }
          }
          if (found === "cancelled") {
            return { ok: false, doneText: t("cancel.alreadyCancelled") }
          }
          if (found === "started") {
            return { ok: false, doneText: t("cancel.started") }
          }
          const result = await cancelBooking(businessId, bookingId)
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("cancel.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("cancel.done") }
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
      label: t("steps.deleteService"),
      doneLabel: t("stepsDone.deleteService"),
      run: async () => ({ error: t("tapFirst.deleteService") }),
      confirm: {
        describe: async (args: unknown) => {
          const a = asRecord(args)
          if (!a || typeof a.serviceId !== "string" || a.serviceId === "") {
            return { error: t("errors.serviceIdRequired") }
          }
          const { services } = await getOwnerBusiness(businessId)
          const service = services.find((s) => s.id === a.serviceId)
          if (!service) {
            return { error: t("errors.serviceUnknown") }
          }
          return {
            title: t("cards.deleteService"),
            action: t("actions.deleteService"),
            summary: `${service.name} · ${t("booking.minutes", { durationMinutes: String(service.durationMinutes) })}`,
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const a = asRecord(args)
          const serviceId = a?.serviceId
          if (typeof serviceId !== "string" || serviceId === "") {
            return { ok: false, doneText: t("deleteService.unknown") }
          }
          const result = await deleteService(businessId, serviceId)
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("deleteService.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("deleteService.done") }
        },
      },
    },
    {
      definition: {
        name: "create_service_category",
        description: `Add a service category, like Hair or Nails, to group services. At most ${BOOKING_RULES.maxServiceCategories} per business. create_service and update_service put services in it with categoryId. Needs the owner's tap.`,
        parameters: schema(
          {
            name: {
              type: "string",
              description: `Category name, 1-${BOOKING_RULES.maxServiceCategoryName} characters`,
            },
          },
          ["name"]
        ),
        needsConfirm: true,
        resultKind: "services",
      },
      label: t("steps.createServiceCategory"),
      doneLabel: t("stepsDone.createServiceCategory"),
      run: async () => ({ error: t("tapFirst.createServiceCategory") }),
      confirm: {
        describe: async (args: unknown) => {
          const name = validCategoryName(asRecord(args)?.name)
          if (!name) {
            return {
              error: t("errors.nameInvalid", { max: String(BOOKING_RULES.maxServiceCategoryName) }),
            }
          }
          const { categories } = await getOwnerBusiness(businessId)
          if (categories.length >= BOOKING_RULES.maxServiceCategories) {
            return {
              error: t("errors.serviceCategoriesFull", { max: String(BOOKING_RULES.maxServiceCategories) }),
            }
          }
          if (categories.some((c) => sameCategoryName(c.name, name))) {
            return { error: t("errors.serviceCategoryExists", { name }) }
          }
          return {
            title: t("cards.createServiceCategory"),
            action: t("actions.createServiceCategory"),
            summary: name,
            destructive: false,
          }
        },
        // The action checks the name and the count again at the tap.
        execute: async (args: unknown) => {
          const name = validCategoryName(asRecord(args)?.name)
          if (!name) {
            return {
              ok: false,
              doneText: t("createServiceCategory.failed", { error: t("errors.nameInvalid", { max: String(BOOKING_RULES.maxServiceCategoryName) }) }),
            }
          }
          const result = await createServiceCategory(businessId, { name })
          if (!result.ok) {
            return {
              ok: false,
              doneText:
                result.error === "taken"
                  ? t("createServiceCategory.taken", { name })
                  : t("createServiceCategory.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("createServiceCategory.done", { name }) }
        },
      },
    },
    {
      definition: {
        name: "rename_service_category",
        description:
          "Rename a service category. Use the id from list_services categories. Needs the owner's tap.",
        parameters: schema(
          {
            categoryId: {
              type: "string",
              description: "Id from list_services categories",
            },
            name: {
              type: "string",
              description: `New name, 1-${BOOKING_RULES.maxServiceCategoryName} characters`,
            },
          },
          ["categoryId", "name"]
        ),
        needsConfirm: true,
        resultKind: "services",
      },
      label: t("steps.renameServiceCategory"),
      doneLabel: t("stepsDone.renameServiceCategory"),
      run: async () => ({ error: t("tapFirst.renameServiceCategory") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkRenameCategoryArgs(args)
          if ("error" in checked) {
            return checked
          }
          if (
            checked.categories.some(
              (c) =>
                c.id !== checked.category.id &&
                sameCategoryName(c.name, checked.name)
            )
          ) {
            return { error: t("errors.serviceCategoryExists", { name: checked.name }) }
          }
          return {
            title: t("cards.renameServiceCategory"),
            action: t("actions.renameServiceCategory"),
            summary: `${checked.category.name} → ${checked.name}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkRenameCategoryArgs(args)
          if ("error" in checked) {
            return {
              ok: false,
              doneText:
                checked.error === t("errors.serviceCategoryUnknown") ||
                checked.error === t("errors.serviceCategoryIdRequired")
                  ? t("renameServiceCategory.unknown")
                  : t("renameServiceCategory.failed", { error: checked.error }),
            }
          }
          // Only its name: its colour stays.
          const result = await updateServiceCategory(
            businessId,
            checked.category.id,
            { name: checked.name }
          )
          if (!result.ok) {
            const refusals: Record<string, string> = {
              not_found: t("renameServiceCategory.unknown"),
              taken: t("renameServiceCategory.taken", { name: checked.name }),
            }
            return {
              ok: false,
              doneText:
                refusals[result.error] ??
                t("renameServiceCategory.failed", { error: result.error }),
            }
          }
          return {
            ok: true,
            doneText: t("renameServiceCategory.done", { name: checked.name }),
          }
        },
      },
    },
    {
      definition: {
        name: "delete_service_category",
        description:
          "Remove a service category. Its services move to Other and are never deleted. Use the id from list_services categories. Needs the owner's tap.",
        parameters: schema(
          {
            categoryId: {
              type: "string",
              description: "Id from list_services categories",
            },
          },
          ["categoryId"]
        ),
        needsConfirm: true,
        resultKind: "services",
      },
      label: t("steps.deleteServiceCategory"),
      doneLabel: t("stepsDone.deleteServiceCategory"),
      run: async () => ({ error: t("tapFirst.deleteServiceCategory") }),
      confirm: {
        describe: async (args: unknown) => {
          const found = await findServiceCategory(args)
          if ("error" in found) {
            return found
          }
          return {
            title: t("cards.deleteServiceCategory"),
            action: t("actions.deleteServiceCategory"),
            // The same words as the Services screen's own removal.
            summary: `${found.category.name} · ${ownerT("catalog.categories.movesToOther")}`,
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const categoryId = asRecord(args)?.categoryId
          if (typeof categoryId !== "string" || categoryId === "") {
            return { ok: false, doneText: t("deleteServiceCategory.unknown") }
          }
          const result = await deleteServiceCategory(businessId, categoryId)
          if (!result.ok) {
            return {
              ok: false,
              doneText:
                result.error === "not_found"
                  ? t("deleteServiceCategory.unknown")
                  : t("deleteServiceCategory.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("deleteServiceCategory.done") }
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
      label: t("steps.deleteMember"),
      doneLabel: t("stepsDone.deleteMember"),
      run: async () => ({ error: t("tapFirst.deleteMember") }),
      confirm: {
        describe: async (args: unknown) => {
          const a = asRecord(args)
          if (!a || typeof a.memberId !== "string" || a.memberId === "") {
            return { error: t("errors.memberIdRequired") }
          }
          const { team } = await getOwnerBusiness(businessId)
          const member = team.find((m) => m.id === a.memberId)
          if (!member) {
            return { error: t("errors.memberUnknown") }
          }
          return {
            title: t("cards.deleteMember"),
            action: t("actions.deleteMember"),
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
              doneText: t("deleteMember.unknown"),
            }
          }
          const result = await deleteTeamMember(businessId, memberId)
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("deleteMember.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("deleteMember.done") }
        },
      },
    },
    {
      definition: {
        name: "create_team_member",
        description: `Add a team member. Name is 1-${BOOKING_RULES.maxTeamName} characters. Needs the owner's tap.`,
        parameters: schema({ name: { type: "string" } }, ["name"]),
        needsConfirm: true,
        resultKind: "team",
      },
      label: t("steps.createMember"),
      doneLabel: t("stepsDone.createMember"),
      run: async () => ({ error: t("tapFirst.createMember") }),
      confirm: {
        describe: async (args: unknown) => {
          const name = validName(
            asRecord(args)?.name,
            BOOKING_RULES.maxTeamName
          )
          if (!name) {
            return { error: t("errors.nameInvalid", { max: String(BOOKING_RULES.maxTeamName) }) }
          }
          const { team } = await getOwnerBusiness(businessId)
          if (team.length >= BOOKING_RULES.maxTeam) {
            return { error: t("errors.teamFull", { max: String(BOOKING_RULES.maxTeam) }) }
          }
          return {
            title: t("cards.createMember"),
            action: t("actions.createMember"),
            summary: name,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const name = validName(
            asRecord(args)?.name,
            BOOKING_RULES.maxTeamName
          )
          if (!name) {
            return {
              ok: false,
              doneText: t("createMember.failed", { error: t("errors.nameInvalid", { max: String(BOOKING_RULES.maxTeamName) }) }),
            }
          }
          const result = await createTeamMember(businessId, name)
          if (!result.ok) {
            return { ok: false, doneText: t("createMember.failed", { error: result.error }) }
          }
          return { ok: true, doneText: t("createMember.done", { name }) }
        },
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
      label: t("steps.serviceTeam"),
      doneLabel: t("stepsDone.serviceTeam"),
      run: async () => ({ error: t("tapFirst.serviceTeam") }),
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
            title: t("cards.serviceTeam"),
            action: t("actions.serviceTeam"),
            summary: `${checked.service.name} · ${names.length > 0 ? names.join(", ") : t("serviceTeam.anyone")}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkServiceTeamArgs(args)
          if ("error" in checked) {
            if (
              checked.error === t("errors.serviceUnknown") ||
              checked.error === t("errors.serviceIdRequired")
            ) {
              return { ok: false, doneText: t("serviceTeam.unknown") }
            }
            return {
              ok: false,
              doneText: t("serviceTeam.failed", { error: checked.error }),
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
              doneText: t("serviceTeam.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("serviceTeam.done") }
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
      label: t("steps.memberServices"),
      doneLabel: t("stepsDone.memberServices"),
      run: async () => ({ error: t("tapFirst.memberServices") }),
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
            title: t("cards.memberServices"),
            action: t("actions.memberServices"),
            summary: `${checked.member.name} · ${names.length > 0 ? names.join(", ") : t("memberServices.none")}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkMemberServicesArgs(args)
          if ("error" in checked) {
            if (
              checked.error === t("errors.memberUnknown") ||
              checked.error === t("errors.memberIdRequired")
            ) {
              return { ok: false, doneText: t("memberServices.unknown") }
            }
            return {
              ok: false,
              doneText: t("memberServices.failed", { error: checked.error }),
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
              doneText: t("memberServices.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("memberServices.done") }
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
      label: t("steps.createAddon"),
      doneLabel: t("stepsDone.createAddon"),
      run: async () => ({ error: t("tapFirst.createAddon") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkAddonGroupArgs(args, null)
          if ("error" in checked) {
            return checked
          }
          return {
            title: t("cards.createAddon"),
            action: t("actions.createAddon"),
            summary: `${checked.input.name} · ${checked.input.prompt} · ${checked.input.options.map((o) => o.name).join(", ")}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkAddonGroupArgs(args, null)
          if ("error" in checked) {
            return {
              ok: false,
              doneText: t("createAddon.failed", { error: checked.error }),
            }
          }
          const result = await createAddonGroup(businessId, {
            ...checked.input,
            options: checked.input.options.map((o) => ({ ...o, id: null })),
          })
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("createAddon.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("createAddon.done") }
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
      label: t("steps.updateAddon"),
      doneLabel: t("stepsDone.updateAddon"),
      run: async () => ({ error: t("tapFirst.updateAddon") }),
      confirm: {
        describe: async (args: unknown) => {
          const a = asRecord(args)
          if (!a || typeof a.groupId !== "string" || a.groupId === "") {
            return { error: t("errors.groupIdRequired") }
          }
          const groups = await getAddonGroups(businessId)
          const current = groups.find((g) => g.id === a.groupId)
          if (!current) {
            return { error: t("errors.groupUnknown") }
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
          const currentIds = new Set(current.options.map((o) => o.id))
          const nextIds = new Set(checked.input.options.map((o) => o.id))
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
            return { error: t("errors.nothingToChange") }
          }
          return {
            title: t("cards.updateAddon"),
            action: t("actions.updateAddon"),
            summary: `${current.name} · ${parts.join(" · ")}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const a = asRecord(args)
          if (!a || typeof a.groupId !== "string" || a.groupId === "") {
            return { ok: false, doneText: t("updateAddon.unknown") }
          }
          const groups = await getAddonGroups(businessId)
          const current = groups.find((g) => g.id === a.groupId)
          if (!current) {
            return { ok: false, doneText: t("updateAddon.unknown") }
          }
          const checked = await checkAddonGroupArgs(args, current)
          if ("error" in checked) {
            return {
              ok: false,
              doneText: t("updateAddon.failed", { error: checked.error }),
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
              doneText: t("updateAddon.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("updateAddon.done") }
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
      label: t("steps.deleteAddon"),
      doneLabel: t("stepsDone.deleteAddon"),
      run: async () => ({ error: t("tapFirst.deleteAddon") }),
      confirm: {
        describe: async (args: unknown) => {
          const a = asRecord(args)
          if (!a || typeof a.groupId !== "string" || a.groupId === "") {
            return { error: t("errors.groupIdRequired") }
          }
          const groups = await getAddonGroups(businessId)
          const group = groups.find((g) => g.id === a.groupId)
          if (!group) {
            return { error: t("errors.groupUnknown") }
          }
          return {
            title: t("cards.deleteAddon"),
            action: t("actions.deleteAddon"),
            summary: `${group.name} · ${group.options.map((o) => o.name).join(", ")}`,
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const a = asRecord(args)
          const groupId = a?.groupId
          if (typeof groupId !== "string" || groupId === "") {
            return { ok: false, doneText: t("deleteAddon.unknown") }
          }
          const result = await deleteAddonGroup(businessId, groupId)
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("deleteAddon.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("deleteAddon.done") }
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
      label: t("steps.updateBusiness"),
      doneLabel: t("stepsDone.updateBusiness"),
      run: async () => ({ error: t("tapFirst.updateBusiness") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkBusinessDetailsArgs(args)
          if ("error" in checked) {
            return checked
          }
          const short = (value: string | null): string =>
            value === null ? "" : value.length > 60 ? value.slice(0, 60) : value
          const rows: [string, string | null, string | null][] = [
            [t("updateBusiness.fields.name"), checked.current.name, checked.input.name],
            [t("updateBusiness.fields.address"), checked.current.address, checked.input.address],
            [
              t("updateBusiness.fields.about"),
              checked.current.description,
              checked.input.description,
            ],
            [t("updateBusiness.fields.phone"), checked.current.phone, checked.input.phone],
            [t("updateBusiness.fields.website"), checked.current.website, checked.input.website],
            [
              t("updateBusiness.fields.seats"),
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
            return { error: t("errors.nothingToChange") }
          }
          return {
            title: t("cards.updateBusiness"),
            action: t("actions.updateBusiness"),
            summary: parts.join(" · "),
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkBusinessDetailsArgs(args)
          if ("error" in checked) {
            return {
              ok: false,
              doneText: t("updateBusiness.failed", { error: checked.error }),
            }
          }
          const result = await updateBusinessDetails(businessId, checked.input)
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("updateBusiness.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("updateBusiness.done") }
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
      label: t("steps.hours"),
      doneLabel: t("stepsDone.hours"),
      run: async () => ({
        error: t("tapFirst.hours"),
      }),
      confirm: {
        describe: async (args: unknown) => {
          const rows = validHoursRows(asRecord(args)?.rows)
          if (!rows) {
            return { error: t("errors.rowsInvalid", { max: String(BOOKING_RULES.maxHoursRows) }) }
          }
          const lines = [...rows]
            .sort((x, y) => x.weekday - y.weekday)
            .map(
              (r) =>
                `${formatWeekday(r.weekday, locale)} ${r.opensAt}–${r.closesAt}`
            )
          return {
            title: t("cards.hours"),
            action: t("actions.hours"),
            summary: lines.length > 0 ? lines.join(", ") : t("booking.closedWeek"),
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const rows = validHoursRows(asRecord(args)?.rows)
          if (!rows) {
            return { ok: false, doneText: t("hours.invalid") }
          }
          const result = await saveHours(businessId, rows)
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("hours.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("hours.done") }
        },
      },
    },
    {
      definition: {
        name: "find_free_times",
        description: `Free start times per day for a service with any extras, found by the names the owner said. Default is today plus 6 days. At most ${ASSISTANT_RULES.maxFreeTimesDays} days at once. When the service or team member is unclear, it returns the choices to ask about.`,
        parameters: schema({
          service: {
            type: "string",
            description: "Service name as the owner said it",
          },
          teamMember: {
            type: "string",
            description: "Team member name as said, omit for anyone",
          },
          extras: EXTRAS_PARAMETER,
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
      label: t("steps.freeTimes"),
      doneLabel: t("stepsDone.freeTimes"),
      run: async (args: unknown) => {
        const a = asRecord(args)
        const serviceWanted = a?.service ?? a?.serviceId
        if (
          !a ||
          typeof serviceWanted !== "string" ||
          serviceWanted.trim() === ""
        ) {
          return bad(t("errors.serviceRequired"))
        }
        const memberRaw = a.teamMember ?? a.teamMemberId
        const memberWanted =
          memberRaw === undefined || memberRaw === null ? null : memberRaw
        if (
          memberWanted !== null &&
          (typeof memberWanted !== "string" || memberWanted.trim() === "")
        ) {
          return bad(t("errors.teamMemberInvalid"))
        }
        const { business, services, team } =
          await getBusinessForNames(businessId)
        const servicePick = pickByName(services, serviceWanted)
        if ("choices" in servicePick) {
          return bad(t("errors.serviceWhich", { names: servicePick.choices.join(", ") }))
        }
        let teamMember: { id: string; name: string } | null = null
        if (memberWanted !== null) {
          const memberPick = pickByName(team, memberWanted)
          if ("choices" in memberPick) {
            return bad(t("errors.memberWhich", { names: memberPick.choices.join(", ") }))
          }
          teamMember = memberPick.found
        }
        const today = zonedToday(Date.now(), business.timezone)
        const from = a.from === undefined ? today : a.from
        const to = a.to === undefined ? addDaysStr(today, 6) : a.to
        if (typeof from !== "string" || !isRealDate(from) || from < today) {
          return bad(t("errors.fromInvalid"))
        }
        if (typeof to !== "string" || !isRealDate(to) || to < from) {
          return bad(t("errors.toInvalid"))
        }
        if (daysInRange(from, to) > ASSISTANT_RULES.maxFreeTimesDays) {
          return bad(t("errors.spanInvalid", { max: String(ASSISTANT_RULES.maxFreeTimesDays) }))
        }
        const extras = await pickExtras(
          businessId,
          servicePick.found,
          a.extras,
          t
        )
        if ("error" in extras) {
          return extras
        }
        const found = await getAvailability(
          business.slug,
          servicePick.found.id,
          teamMember?.id ?? null,
          extras.ids
        )
        if (!found) {
          return bad(t("errors.freeTimesUnknown"))
        }
        const inRange = found.days.filter((d) => d.date >= from && d.date <= to)
        const capped = inRange.slice(0, ASSISTANT_RULES.maxFreeTimesDays)
        return {
          service: servicePick.found.name,
          teamMember: teamMember?.name ?? null,
          days: capped.map((day) => ({
            ...day,
            dayText: formatDay(day.date, locale),
            timesText: day.times.map((time) => formatClock(time, locale)),
          })),
          total: inRange.length,
          truncated: inRange.length > capped.length,
        }
      },
    },
    {
      definition: {
        name: "create_booking",
        description:
          "Book an appointment for a CUSTOMER in one step: pass what the owner said (service, extras, team member, day or date, time, customer name). It finds the service, extras and team member by name and checks the time is free; when something is unclear or taken, it returns the choices to ask about. name is the customer being booked, never a team member. Its card is the confirmation and needs the owner's tap.",
        // One call instead of list_services → list_team → find_free_times →
        // create_booking: "Combine functions that are always called in
        // sequence" (OpenAI function calling guide:
        // https://developers.openai.com/api/docs/guides/function-calling).
        parameters: schema(
          {
            service: {
              type: "string",
              description: "Service name as the owner said it",
            },
            teamMember: {
              type: "string",
              description: "Team member name as said, omit for anyone",
            },
            extras: EXTRAS_PARAMETER,
            day: { type: "string", enum: ["today", "tomorrow"] },
            date: {
              type: "string",
              description:
                "YYYY-MM-DD in the business timezone, for other days",
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
          ["service", "time", "name"]
        ),
        needsConfirm: true,
        resultKind: "bookings",
      },
      label: t("steps.booking"),
      doneLabel: t("stepsDone.booking"),
      run: async () => ({ error: t("tapFirst.booking") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkBookingArgs(businessId, args, t, locale)
          if ("error" in checked) {
            return checked
          }
          return {
            title: t("cards.book"),
            action: t("actions.book"),
            summary:
              `${checked.name} · ${[checked.service.name, ...checked.extras.names].join(" + ")} · ` +
              `${formatDay(checked.date, locale)} · ${formatClock(checked.time, locale)} · ` +
              `${checked.memberName} · ${t("booking.minutes", { durationMinutes: String(checked.durationMinutes) })} · ${checked.price}`,
            destructive: false,
            args: bookingToRun(checked),
          }
        },
        declinedText: t("booking.declined"),
        // Books the stored booking as the card showed it, by ids, with no
        // name or day looked up again. createOwnerBooking still checks the
        // service, the team member and that the time is free.
        execute: async (args: unknown) => {
          const booking = asBookingToRun(args)
          if (!booking) {
            return { ok: false, doneText: t("booking.failed") }
          }
          // allowConflict is always false: the model can never double-book.
          const result = await createOwnerBooking({
            businessId,
            serviceId: booking.serviceId,
            teamMemberId: booking.teamMemberId,
            addonIds: booking.addonIds,
            date: booking.date,
            time: booking.time,
            name: booking.name,
            phone: booking.phone,
            note: booking.note,
            allowConflict: false,
          })
          const when = t("booking.at", { day: formatDay(booking.date, locale), time: formatClock(booking.time, locale) })
          if (result.status === "booked") {
            return {
              ok: true,
              doneText: t("booking.booked", { name: booking.name, service: booking.serviceName, when }),
            }
          }
          if (result.status === "conflict") {
            return {
              ok: false,
              doneText: t("booking.couldNotBook", { reason: result.reason === "closed"
                  ? t("booking.conflictClosed")
                  : t("booking.conflictTaken") }),
            }
          }
          if (result.status === "invalid") {
            const field = `booking.fields.${result.field}` as const
            return {
              ok: false,
              doneText: t("booking.couldNotBook", {
                reason: t.has(field) ? t(field) : t("booking.invalidFallback"),
              }),
            }
          }
          return { ok: false, doneText: t("booking.failed") }
        },
      },
    },
    {
      definition: {
        name: "move_booking",
        description:
          "Move a booking that has not started to another day or time, with the same person and length. Use the id from list_bookings. It checks the time is free and returns the free times when it is not. Its card is the confirmation and needs the owner's tap.",
        parameters: schema(
          {
            bookingId: { type: "string", description: "Id from list_bookings" },
            day: { type: "string", enum: ["today", "tomorrow"] },
            date: {
              type: "string",
              description:
                "YYYY-MM-DD in the business timezone, for other days",
            },
            time: {
              type: "string",
              description: "HH:mm in the business timezone",
            },
          },
          ["bookingId", "time"]
        ),
        needsConfirm: true,
        resultKind: "bookings",
      },
      label: t("steps.moveBooking"),
      doneLabel: t("stepsDone.moveBooking"),
      run: async () => ({ error: t("tapFirst.moveBooking") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkMoveArgs(args)
          if ("error" in checked) {
            return checked
          }
          const { booking, date, time } = checked
          return {
            title: t("cards.moveBooking"),
            action: t("actions.moveBooking"),
            summary:
              `${booking.customerName} · ${booking.serviceName} · ` +
              `${t("booking.at", { day: formatDay(booking.date, locale), time: formatClock(booking.time, locale) })} → ` +
              t("booking.at", { day: formatDay(date, locale), time: formatClock(time, locale) }),
            destructive: false,
            // The date the card showed, so the tap moves exactly this even
            // after midnight.
            args: { bookingId: booking.id, date, time },
          }
        },
        // allowConflict is always false: the model can never double-book.
        // moveOwnerBooking still checks the booking and that the time is free.
        execute: async (args: unknown) => {
          const a = asRecord(args)
          if (
            typeof a?.bookingId !== "string" ||
            typeof a.date !== "string" ||
            typeof a.time !== "string"
          ) {
            return { ok: false, doneText: t("moveBooking.invalid") }
          }
          const result = await moveOwnerBooking({
            businessId,
            bookingId: a.bookingId,
            date: a.date,
            time: a.time,
            allowConflict: false,
          })
          if (result.status === "moved") {
            return {
              ok: true,
              doneText: t("moveBooking.done", { when: t("booking.at", { day: formatDay(a.date, locale), time: formatClock(a.time, locale) }) }),
            }
          }
          if (result.status === "conflict") {
            return {
              ok: false,
              doneText: t("moveBooking.couldNotMove", { reason: result.reason === "closed"
                  ? t("booking.conflictClosed")
                  : t("booking.conflictTaken") }),
            }
          }
          if (result.status === "invalid") {
            return {
              ok: false,
              doneText: t("moveBooking.couldNotMove", { reason: result.field === "date"
                  ? t("moveBooking.badDate")
                  : t("moveBooking.badTime") }),
            }
          }
          return { ok: false, doneText: t("moveBooking.failed") }
        },
      },
    },
    {
      definition: {
        name: "add_customer",
        description:
          "Add a customer by hand: a name and, if the owner gives one, a phone. Never invent a phone. Needs the owner's tap.",
        parameters: schema(
          {
            name: { type: "string", description: "Customer name" },
            phone: {
              type: "string",
              description: "Customer phone, omit when unknown",
            },
          },
          ["name"]
        ),
        needsConfirm: true,
        resultKind: "customers",
      },
      label: t("steps.addCustomer"),
      doneLabel: t("stepsDone.addCustomer"),
      run: async () => ({ error: t("tapFirst.addCustomer") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = checkCustomerArgs(args)
          if ("error" in checked) {
            return checked
          }
          return {
            title: t("cards.addCustomer"),
            action: t("actions.addCustomer"),
            summary: checked.phone
              ? `${checked.name} · ${checked.phone}`
              : checked.name,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = checkCustomerArgs(args)
          if ("error" in checked) {
            return { ok: false, doneText: t("addCustomer.invalid") }
          }
          const result = await addCustomer(businessId, checked)
          if (!result.ok) {
            return {
              ok: false,
              doneText:
                result.error === "exists"
                  ? t("addCustomer.exists")
                  : t("addCustomer.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("addCustomer.done") }
        },
      },
    },
    {
      definition: {
        name: "set_member_hours",
        description: `Set when one team member works. Use the id from list_team. rows replaces their whole week, at most ${BOOKING_RULES.maxHoursRows} rows of weekday (0 Sunday to 6 Saturday) with open and close HH:mm; null makes them follow the business hours. Hours outside the business hours do not count. Nothing else about them changes. Needs the owner's tap.`,
        parameters: schema(
          {
            memberId: { type: "string", description: "Id from list_team" },
            rows: {
              type: ["array", "null"],
              description: "Their weekly hours, or null for the business hours",
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
          ["memberId", "rows"]
        ),
        needsConfirm: true,
        resultKind: "team",
      },
      label: t("steps.memberHours"),
      doneLabel: t("stepsDone.memberHours"),
      run: async () => ({ error: t("tapFirst.memberHours") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkMemberHoursArgs(args)
          if ("error" in checked) {
            return checked
          }
          return {
            title: t("cards.memberHours"),
            action: t("actions.memberHours"),
            summary: `${checked.member.name} · ${
              checked.rows
                ? hoursLine(locale, checked.rows)
                : t("memberHours.sameAsBusiness")
            }`,
            destructive: true,
          }
        },
        // The action saves a person's details and hours together, so their
        // details are read again here and sent back as they are now. Sending
        // the card's copy would undo an edit made after it showed.
        execute: async (args: unknown) => {
          const checked = await checkMemberHoursArgs(args)
          if ("error" in checked) {
            if (
              checked.error === t("errors.memberUnknown") ||
              checked.error === t("errors.memberIdRequired")
            ) {
              return { ok: false, doneText: t("memberHours.unknown") }
            }
            return {
              ok: false,
              doneText: t("memberHours.failed", { error: checked.error }),
            }
          }
          const { member, rows } = checked
          const result = await saveTeamMemberWithHours(
            businessId,
            member.id,
            {
              name: member.name,
              phone: member.phone,
              email: member.email,
              description: member.description,
              about: member.about,
              languages: member.languages ?? [],
            },
            rows
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("memberHours.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("memberHours.done") }
        },
      },
    },
    {
      definition: {
        name: "invite_team_member",
        description:
          "Email a team member a link to join with their own account; it ends any older link. Use the id from list_team. They need an email on file. Needs the owner's tap.",
        parameters: schema(
          { memberId: { type: "string", description: "Id from list_team" } },
          ["memberId"]
        ),
        needsConfirm: true,
        resultKind: "team",
      },
      label: t("steps.invite"),
      doneLabel: t("stepsDone.invite"),
      run: async () => ({ error: t("tapFirst.invite") }),
      confirm: {
        describe: async (args: unknown) => {
          const found = await findMember(args)
          if ("error" in found) {
            return found
          }
          const { member } = found
          if (member.userId) {
            return { error: t("errors.memberJoined") }
          }
          if (!member.email) {
            return { error: t("errors.memberNoEmail") }
          }
          return {
            title: t("cards.invite"),
            action: t("actions.invite"),
            summary: `${member.name} · ${member.email}`,
            destructive: false,
          }
        },
        // The link is a one-use key, kept only as a hash. It never goes in
        // the result, which is saved in the chat and the audit log. Someone
        // the email did not reach gets a new link from the Team page.
        execute: async (args: unknown) => {
          const found = await findMember(args)
          if ("error" in found) {
            return { ok: false, doneText: t("invite.unknown") }
          }
          if (!found.member.email) {
            return { ok: false, doneText: t("invite.noEmail") }
          }
          const result = await sendTeamInvite(businessId, found.member.id)
          if (!result.ok) {
            return { ok: false, doneText: t("invite.failed") }
          }
          return result.emailedTo
            ? { ok: true, doneText: t("invite.done", { name: found.member.name }) }
            : { ok: false, doneText: t("invite.notEmailed") }
        },
      },
    },
    {
      definition: {
        name: "remove_team_access",
        description:
          "End a team member's own account access. They stay on the team and their bookings stay. Use the id from list_team. Needs the owner's tap.",
        parameters: schema(
          { memberId: { type: "string", description: "Id from list_team" } },
          ["memberId"]
        ),
        needsConfirm: true,
        resultKind: "team",
      },
      label: t("steps.removeAccess"),
      doneLabel: t("stepsDone.removeAccess"),
      run: async () => ({ error: t("tapFirst.removeAccess") }),
      confirm: {
        describe: async (args: unknown) => {
          const found = await findMember(args)
          if ("error" in found) {
            return found
          }
          if (!found.member.userId) {
            return { error: t("errors.memberNoAccess") }
          }
          return {
            title: t("cards.removeAccess"),
            action: t("actions.removeAccess"),
            summary: found.member.name,
            destructive: true,
          }
        },
        // The action answers ok for any id, so the member is checked first.
        execute: async (args: unknown) => {
          const found = await findMember(args)
          if ("error" in found) {
            return { ok: false, doneText: t("removeAccess.unknown") }
          }
          const result = await removeTeamAccess(businessId, found.member.id)
          return result.ok
            ? { ok: true, doneText: t("removeAccess.done") }
            : { ok: false, doneText: t("removeAccess.failed") }
        },
      },
    },
    {
      definition: {
        name: "suggest_services",
        description:
          "Muse suggests services this business could offer, each with a category name (an existing one or a new one; null = Other). It saves nothing: show them and ask which to add; a new category is added with create_service_category first.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t("steps.suggestServices"),
      doneLabel: t("stepsDone.suggestServices"),
      run: async () => {
        const result = await suggestServices(businessId, language)
        if (!result.ok) {
          return bad(
            result.error === "ai_off" ? t("errors.aiOff") : t("errors.suggestFailed")
          )
        }
        return { services: result.services, saved: false }
      },
    },
    {
      definition: {
        name: "suggest_addons",
        description:
          "Muse suggests extras groups for this business's services, without prices. It saves nothing: show them and ask which to add; create_addon_group adds one.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t("steps.suggestAddons"),
      doneLabel: t("stepsDone.suggestAddons"),
      run: async () => {
        const result = await suggestAddonGroups(businessId, language)
        if (!result.ok) {
          return bad(
            result.error === "ai_off" ? t("errors.aiOff") : t("errors.suggestFailed")
          )
        }
        return { groups: result.groups, saved: false }
      },
    },
    {
      definition: {
        name: "improve_details",
        description:
          "Muse polishes the saved business name and About text. It saves nothing: show the result; update_business_details saves it if the owner wants it.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t("steps.improveDetails"),
      doneLabel: t("stepsDone.improveDetails"),
      run: async () => {
        const { business } = await getOwnerBusiness(businessId)
        const result = await improveDetails(businessId, {
          name: business.name,
          description: business.description,
        })
        if (!result.ok) {
          return bad(
            result.error === "ai_off" ? t("errors.aiOff") : t("errors.suggestFailed")
          )
        }
        return {
          name: result.name,
          description: result.description,
          saved: false,
        }
      },
    },
    {
      definition: {
        name: "draw_team_photo",
        description:
          "Muse Image draws a photo for a team member who has none, only while the business is still in setup. Use the id from list_team. Needs the owner's tap.",
        parameters: schema(
          { memberId: { type: "string", description: "Id from list_team" } },
          ["memberId"]
        ),
        needsConfirm: true,
        resultKind: "team",
      },
      label: t("steps.drawPhoto"),
      doneLabel: t("stepsDone.drawPhoto"),
      run: async () => ({ error: t("tapFirst.drawPhoto") }),
      confirm: {
        // The same two rules as the action, so no card is shown for a photo
        // it would refuse to draw.
        describe: async (args: unknown) => {
          const found = await findMember(args)
          if ("error" in found) {
            return found
          }
          if (found.member.photoUrl) {
            return { error: t("errors.memberHasPhoto") }
          }
          if (found.business.setupFinishedAt !== null) {
            return { error: t("errors.photoSetupOnly") }
          }
          return {
            title: t("cards.drawPhoto"),
            action: t("actions.drawPhoto"),
            summary: found.member.name,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const memberId = asRecord(args)?.memberId
          if (typeof memberId !== "string" || memberId === "") {
            return { ok: false, doneText: t("drawPhoto.unknown") }
          }
          const result = await drawTeamPhoto(businessId, memberId)
          return result.ok
            ? { ok: true, doneText: t("drawPhoto.done") }
            : { ok: false, doneText: t("drawPhoto.failed") }
        },
      },
    },
    {
      definition: {
        name: "delete_photo",
        description:
          "Delete one business photo for good, by its number on the page: 1 is the first (business_overview has photoCount). Needs the owner's tap.",
        parameters: schema(
          {
            position: {
              type: "integer",
              description: "The photo's number on the page, from 1",
            },
          },
          ["position"]
        ),
        needsConfirm: true,
        resultKind: "photos",
      },
      label: t("steps.deletePhoto"),
      doneLabel: t("stepsDone.deletePhoto"),
      run: async () => ({ error: t("tapFirst.deletePhoto") }),
      confirm: {
        describe: async (args: unknown) => {
          const photos = await getBusinessPhotos(businessId)
          if (photos.length === 0) {
            return { error: t("errors.noPhotos") }
          }
          const position = asRecord(args)?.position
          if (
            !Number.isInteger(position) ||
            (position as number) < 1 ||
            (position as number) > photos.length
          ) {
            return { error: t("errors.photoPositionInvalid", { total: String(photos.length) }) }
          }
          return {
            title: t("cards.deletePhoto"),
            action: t("actions.deletePhoto"),
            summary: t("photos.one", { position: String(position as number), total: String(photos.length) }),
            destructive: true,
            // The photo itself, so a change in the order never deletes
            // another one.
            args: { photoId: photos[(position as number) - 1].id },
          }
        },
        execute: async (args: unknown) => {
          const photoId = asRecord(args)?.photoId
          if (typeof photoId !== "string" || photoId === "") {
            return { ok: false, doneText: t("photos.unknown") }
          }
          const result = await deleteBusinessPhoto(businessId, photoId)
          if (!result.ok) {
            return {
              ok: false,
              doneText:
                result.error === "not_found"
                  ? t("photos.unknown")
                  : t("photos.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("photos.deleted") }
        },
      },
    },
    {
      definition: {
        name: "reorder_photos",
        description:
          "Put the business photos in a new order. order lists every photo's number on the page once, in the new order: [2, 1, 3] puts photo 2 first. Needs the owner's tap.",
        parameters: schema(
          {
            order: {
              type: "array",
              description: "Every photo number, in the new order",
              items: { type: "integer" },
            },
          },
          ["order"]
        ),
        needsConfirm: true,
        resultKind: "photos",
      },
      label: t("steps.reorderPhotos"),
      doneLabel: t("stepsDone.reorderPhotos"),
      run: async () => ({ error: t("tapFirst.reorderPhotos") }),
      confirm: {
        describe: async (args: unknown) => {
          const photos = await getBusinessPhotos(businessId)
          if (photos.length === 0) {
            return { error: t("errors.noPhotos") }
          }
          const numbers = photos.map((_, index) => index + 1)
          const order = asRecord(args)?.order
          const wanted = newOrder(
            Array.isArray(order) ? order.map(String) : order,
            numbers.map(String)
          )
          if (!wanted) {
            return { error: t("errors.photoOrderInvalid", { total: String(photos.length) }) }
          }
          if (wanted.join() === numbers.join()) {
            return { error: t("errors.nothingToChange") }
          }
          return {
            title: t("cards.reorderPhotos"),
            action: t("actions.reorder"),
            summary: t("photos.order", { positions: wanted.join(", ") }),
            destructive: false,
            // The photos themselves, in the order the card showed.
            args: {
              photoIds: wanted.map((number) => photos[Number(number) - 1].id),
            },
          }
        },
        // The action needs every photo, so one added or deleted since the
        // card showed is refused rather than guessed.
        execute: async (args: unknown) => {
          const photoIds = asRecord(args)?.photoIds
          if (
            !Array.isArray(photoIds) ||
            new Set(photoIds).size !== photoIds.length
          ) {
            return { ok: false, doneText: t("photos.unknown") }
          }
          const result = await reorderBusinessPhotos(
            businessId,
            photoIds as string[]
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText:
                result.error === "not_found"
                  ? t("photos.unknown")
                  : t("photos.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("photos.ordered") }
        },
      },
    },
    reorderTool({
      name: "reorder_services",
      argument: "serviceIds",
      listTool: "list_services",
      things: "services",
      resultKind: "services",
      label: t("steps.reorderServices"),
      doneLabel: t("stepsDone.reorderServices"),
      tapFirst: t("tapFirst.reorderServices"),
      title: t("cards.reorderServices"),
      doneText: t("reorder.services"),
      // In the order list_services shows, so the same list is no change.
      list: async () =>
        servicesInShownOrder(await getOwnerBusiness(businessId)),
      save: (ids) => reorderServices(businessId, ids),
    }),
    reorderTool({
      name: "reorder_service_categories",
      argument: "categoryIds",
      // Its categories, not its services: the ids differ.
      listTool: "list_services categories",
      things: "service categories",
      resultKind: "services",
      label: t("steps.reorderServiceCategories"),
      doneLabel: t("stepsDone.reorderServiceCategories"),
      tapFirst: t("tapFirst.reorderServiceCategories"),
      title: t("cards.reorderServiceCategories"),
      doneText: t("reorder.serviceCategories"),
      list: async () => (await getOwnerBusiness(businessId)).categories,
      save: (ids) => reorderServiceCategories(businessId, ids),
    }),
    reorderTool({
      name: "reorder_team",
      argument: "memberIds",
      listTool: "list_team",
      things: "team members",
      resultKind: "team",
      label: t("steps.reorderTeam"),
      doneLabel: t("stepsDone.reorderTeam"),
      tapFirst: t("tapFirst.reorderTeam"),
      title: t("cards.reorderTeam"),
      doneText: t("reorder.team"),
      list: async () => (await getOwnerBusiness(businessId)).team,
      save: (ids) => reorderTeam(businessId, ids),
    }),
    reorderTool({
      name: "reorder_addons",
      argument: "groupIds",
      listTool: "list_addons",
      things: "extras groups",
      resultKind: "services",
      label: t("steps.reorderAddons"),
      doneLabel: t("stepsDone.reorderAddons"),
      tapFirst: t("tapFirst.reorderAddons"),
      title: t("cards.reorderAddons"),
      doneText: t("reorder.addons"),
      list: () => getAddonGroups(businessId),
      save: (ids) => reorderAddonGroups(businessId, ids),
    }),
    {
      definition: {
        name: "list_policies",
        description:
          "The policies on the business page, with their ids: the standard ones (kind booking, terms or privacy) and the owner's own (kind null, with a title); a standard one missing from the list is not on the page. Then the key points customers agree to, with their ids.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t("steps.policies"),
      doneLabel: t("stepsDone.policies"),
      run: () => getPolicies(businessId),
    },
    {
      definition: {
        name: "save_policy",
        description: `Add or change a policy on the business page. With kind (booking, terms or privacy): add that standard policy or replace its text. Without kind: the owner's own policy, a new one (title needed) or, with policyId from list_policies, one of theirs (title only when renaming it). body is the whole text, at most ${POLICY_RULES.maxLength} characters; title at most ${POLICY_RULES.maxTitle}. At most ${POLICY_RULES.maxPolicies} policies in all. Read it with list_policies first when changing part of it. Remove one with remove_policy. Needs the owner's tap.`,
        parameters: schema(
          {
            kind: { type: "string", enum: [...POLICY_KINDS] },
            policyId: {
              type: "string",
              description: "Id of one of the owner's own policies, from list_policies",
            },
            title: {
              type: "string",
              description: "The owner's own policy's title",
            },
            body: { type: "string", description: "The whole new text" },
          },
          ["body"]
        ),
        needsConfirm: true,
        resultKind: "policies",
      },
      label: t("steps.savePolicy"),
      doneLabel: t("stepsDone.savePolicy"),
      run: async () => ({ error: t("tapFirst.savePolicy") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkPolicyArgs(args)
          if ("error" in checked) {
            return checked
          }
          const { kind, current, title, body } = checked
          if (
            current &&
            current.body === body &&
            (kind !== null || current.title === title)
          ) {
            return { error: t("errors.nothingToChange") }
          }
          const name =
            current && kind === null && current.title !== title
              ? `${current.title} → ${title}`
              : policyName({ kind, title })
          // The whole text: it goes live on the page as the owner's words.
          return {
            title: current ? t("cards.savePolicy") : t("cards.addPolicy"),
            action: current ? t("actions.savePolicy") : t("actions.addPolicy"),
            summary: `${name} · ${body}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkPolicyArgs(args)
          if ("error" in checked) {
            return {
              ok: false,
              doneText:
                checked.error === t("errors.policyUnknown")
                  ? t("savePolicy.unknown")
                  : t("savePolicy.failed", { error: checked.error }),
            }
          }
          const { kind, current, title, body } = checked
          const result =
            kind !== null
              ? await savePolicy(businessId, kind, body)
              : await saveOwnPolicy(businessId, current?.id ?? null, {
                  title: title ?? "",
                  body,
                })
          if (!result.ok) {
            return { ok: false, doneText: t("savePolicy.failed", { error: result.error }) }
          }
          return {
            ok: true,
            doneText: current ? t("savePolicy.done") : t("savePolicy.added"),
          }
        },
      },
    },
    {
      definition: {
        name: "remove_policy",
        description:
          "Take one policy off the business page for good, a standard one or the owner's own. Use the id from list_policies. Needs the owner's tap.",
        parameters: schema(
          { policyId: { type: "string", description: "Id from list_policies" } },
          ["policyId"]
        ),
        needsConfirm: true,
        resultKind: "policies",
      },
      label: t("steps.removePolicy"),
      doneLabel: t("stepsDone.removePolicy"),
      run: async () => ({ error: t("tapFirst.removePolicy") }),
      confirm: {
        describe: async (args: unknown) => {
          const policyId = asRecord(args)?.policyId
          if (typeof policyId !== "string" || policyId === "") {
            return { error: t("errors.policyIdRequired") }
          }
          const { policies } = await getPolicies(businessId)
          const policy = policies.find((p) => p.id === policyId)
          if (!policy) {
            return { error: t("errors.policyUnknown") }
          }
          return {
            title: t("cards.removePolicy"),
            action: t("actions.removePolicy"),
            summary: policyName(policy),
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const policyId = asRecord(args)?.policyId
          if (typeof policyId !== "string" || policyId === "") {
            return { ok: false, doneText: t("savePolicy.unknown") }
          }
          const result = await removePolicy(businessId, policyId)
          if (!result.ok) {
            return {
              ok: false,
              doneText:
                result.error === "not_found"
                  ? t("savePolicy.unknown")
                  : t("savePolicy.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("savePolicy.removed") }
        },
      },
    },
    {
      definition: {
        name: "save_policy_point",
        description: `Add a key point customers agree to when booking (no pointId, needs icon, title and body), or change one (pointId from list_policies; only the given fields change). At most ${POLICY_RULES.maxPoints} points; title ${POLICY_RULES.maxPointTitle} characters, body ${POLICY_RULES.maxPointBody}. Needs the owner's tap.`,
        parameters: schema({
          pointId: { type: "string", description: "Id from list_policies" },
          icon: { type: "string", enum: [...POLICY_POINT_ICONS] },
          title: { type: "string" },
          body: { type: "string" },
        }),
        needsConfirm: true,
        resultKind: "policies",
      },
      label: t("steps.savePolicyPoint"),
      doneLabel: t("stepsDone.savePolicyPoint"),
      run: async () => ({ error: t("tapFirst.savePolicyPoint") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkPolicyPointArgs(args)
          if ("error" in checked) {
            return checked
          }
          const { current, input } = checked
          return {
            title: current ? t("cards.savePolicyPoint") : t("cards.addPolicyPoint"),
            action: current
              ? t("actions.savePolicyPoint")
              : t("actions.addPolicyPoint"),
            summary:
              current && current.title !== input.title
                ? `${current.title} → ${input.title} · ${input.body}`
                : `${input.title} · ${input.body}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkPolicyPointArgs(args)
          if ("error" in checked) {
            if (checked.error === t("errors.pointUnknown")) {
              return { ok: false, doneText: t("policyPoint.unknown") }
            }
            if (checked.error === t("errors.pointsFull", { max: String(POLICY_RULES.maxPoints) })) {
              return { ok: false, doneText: t("policyPoint.full") }
            }
            return {
              ok: false,
              doneText: t("policyPoint.failed", { error: checked.error }),
            }
          }
          const { current, input } = checked
          const result = await savePolicyPoint(
            businessId,
            current?.id ?? null,
            input
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("policyPoint.failed", { error: result.error }),
            }
          }
          return {
            ok: true,
            doneText: current ? t("policyPoint.done") : t("policyPoint.added"),
          }
        },
      },
    },
    {
      definition: {
        name: "remove_policy_point",
        description:
          "Remove one key point for good. Use the id from list_policies. Needs the owner's tap.",
        parameters: schema(
          { pointId: { type: "string", description: "Id from list_policies" } },
          ["pointId"]
        ),
        needsConfirm: true,
        resultKind: "policies",
      },
      label: t("steps.removePolicyPoint"),
      doneLabel: t("stepsDone.removePolicyPoint"),
      run: async () => ({ error: t("tapFirst.removePolicyPoint") }),
      confirm: {
        describe: async (args: unknown) => {
          const pointId = asRecord(args)?.pointId
          if (typeof pointId !== "string" || pointId === "") {
            return { error: t("errors.pointIdRequired") }
          }
          const { points } = await getPolicies(businessId)
          const point = points.find((p) => p.id === pointId)
          if (!point) {
            return { error: t("errors.pointUnknown") }
          }
          return {
            title: t("cards.removePolicyPoint"),
            action: t("actions.removePolicyPoint"),
            summary: `${point.title} · ${point.body}`,
            destructive: true,
          }
        },
        // The action answers ok for any id, so the point is checked first.
        execute: async (args: unknown) => {
          const pointId = asRecord(args)?.pointId
          const { points } = await getPolicies(businessId)
          if (
            typeof pointId !== "string" ||
            !points.some((p) => p.id === pointId)
          ) {
            return { ok: false, doneText: t("policyPoint.unknown") }
          }
          const result = await removePolicyPoint(businessId, pointId)
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("policyPoint.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("policyPoint.removed") }
        },
      },
    },
    {
      definition: {
        name: "set_booking_paid",
        description:
          "Mark a booking's payment paid, or not paid after all. Only for a booking that has payment in list_bookings. Only when the owner says they got the money: a customer saying they paid (status reported) is not paid. Needs the owner's tap.",
        parameters: schema(
          {
            bookingId: { type: "string", description: "Id from list_bookings" },
            paid: { type: "boolean" },
          },
          ["bookingId", "paid"]
        ),
        needsConfirm: true,
        resultKind: "bookings",
      },
      label: t("steps.setBookingPaid"),
      doneLabel: t("stepsDone.setBookingPaid"),
      run: async () => ({ error: t("tapFirst.bookingPaid") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkBookingPaidArgs(args)
          if ("error" in checked) {
            return checked
          }
          const { booking, paid } = checked
          const state = paid ? "paid" : "unpaid"
          return {
            title: t(`cards.bookingPaid.${state}`),
            action: t(`actions.bookingPaid.${state}`),
            summary: `${booking.customerName} · ${booking.serviceName} · ${formatDay(booking.date, locale)} · ${formatClock(booking.time, locale)} · ${priceText(t, locale, booking.priceMinor, booking.currency)}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const a = asRecord(args)
          if (
            !a ||
            typeof a.bookingId !== "string" ||
            a.bookingId === "" ||
            typeof a.paid !== "boolean"
          ) {
            return { ok: false, doneText: t("bookingPaid.unknown") }
          }
          const result = await setBookingPaid(businessId, a.bookingId, a.paid)
          if (!result.ok) {
            const refusals: Record<string, string> = {
              not_found: t("bookingPaid.unknown"),
              no_payment: t("bookingPaid.noPayment"),
            }
            return {
              ok: false,
              doneText:
                refusals[result.error] ??
                t("bookingPaid.failed", { error: result.error }),
            }
          }
          return {
            ok: true,
            doneText: t(`bookingPaid.done.${a.paid ? "paid" : "unpaid"}`),
          }
        },
      },
    },
    {
      definition: {
        name: "list_payment_methods",
        description:
          "How customers pay the business. Offline payments, outside the app: the ways (bank transfer, Zelle, Cash App, other) with their ids and private instructions, whether paying at the visit is offered, and how many payments wait for the owner's check. onlinePayments, by card when booking, through the business's own Stripe account: available (the plan has it), stripe (none = not connected, details = Stripe needs more details, ready = connected, country = not in the business's country yet) and customersPay (off, deposit with depositType and depositValue, or full). Connecting Stripe is only done by the owner in Settings, Payments: you never do it. Koblip never holds the money.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t("steps.paymentMethods"),
      doneLabel: t("stepsDone.paymentMethods"),
      run: async () => {
        const [{ methods, payLater, toCheck }, online] = await Promise.all([
          getPaymentSettings(businessId),
          getOnlinePaySettings(businessId),
        ])
        return {
          methods,
          payAtVisit: payLater,
          paymentsToCheck: toCheck,
          max: PAYMENT_RULES.maxMethods,
          onlinePayments: {
            available: online.available,
            stripe: online.stripe,
            customersPay: online.pay?.mode ?? "off",
            ...(online.pay?.mode === "deposit"
              ? {
                  depositType: online.pay.type,
                  depositValue: online.pay.value,
                  depositText: onlinePayText(online.pay, online.currency),
                }
              : {}),
          },
        }
      },
    },
    {
      definition: {
        name: "set_online_payment",
        description:
          "Set what customers pay by card when they book: off, a deposit, or the full price. A deposit is a percent of the price (depositType percent, depositValue 1 to 99) or a fixed amount (depositType amount, depositValue in minor units of the business currency). Only works when onlinePayments in list_payment_methods is available and stripe is not none or country: otherwise tell the owner to connect Stripe in Settings, Payments. Needs the owner's tap.",
        parameters: schema(
          {
            mode: { type: "string", enum: [...ONLINE_PAY_MODES] },
            depositType: { type: "string", enum: [...DEPOSIT_TYPES] },
            depositValue: {
              type: "number",
              description:
                "Percent (1 to 99), or the amount in minor units; only for a deposit",
            },
          },
          ["mode"]
        ),
        needsConfirm: true,
        resultKind: "payments",
      },
      label: t("steps.onlinePayment"),
      doneLabel: t("stepsDone.onlinePayment"),
      run: async () => ({ error: t("tapFirst.onlinePayment") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkOnlinePayArgs(args)
          if ("error" in checked) {
            return checked
          }
          return {
            title: t("cards.onlinePayment"),
            action: t("actions.onlinePayment"),
            summary: onlinePayText(checked.pay, checked.currency),
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkOnlinePayArgs(args)
          if ("error" in checked) {
            return { ok: false, doneText: checked.error }
          }
          const result = await saveOnlinePay(businessId, checked.input)
          return result.ok
            ? { ok: true, doneText: t("onlinePayment.done") }
            : {
                ok: false,
                doneText: t("onlinePayment.failed", { error: result.error }),
              }
        },
      },
    },
    {
      definition: {
        name: "refund_booking",
        description:
          "Give back everything a booking's card payment still holds, to the customer's card, from the business's own Stripe account. Only for a booking with paidOnlineMinor in list_bookings that is not fully refunded. Only when the owner asks to refund. It does not cancel the booking. Needs the owner's tap.",
        parameters: schema(
          {
            bookingId: { type: "string", description: "Id from list_bookings" },
          },
          ["bookingId"]
        ),
        needsConfirm: true,
        resultKind: "bookings",
      },
      label: t("steps.refundBooking"),
      doneLabel: t("stepsDone.refundBooking"),
      run: async () => ({ error: t("tapFirst.refundBooking") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkRefundArgs(args)
          if ("error" in checked) {
            return checked
          }
          const { booking, amountMinor } = checked
          return {
            title: t("cards.refundBooking", {
              amount: formatPrice(amountMinor, booking.currency, locale),
            }),
            action: t("actions.refundBooking"),
            summary: `${booking.customerName} · ${booking.serviceName} · ${formatDay(booking.date, locale)} · ${formatClock(booking.time, locale)}`,
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const bookingId = asRecord(args)?.bookingId
          if (typeof bookingId !== "string" || bookingId === "") {
            return { ok: false, doneText: t("refundBooking.unknown") }
          }
          const result = await refundBooking(businessId, bookingId)
          if (!result.ok) {
            const refusals: Record<string, string> = {
              not_found: t("refundBooking.unknown"),
              nothing: t("refundBooking.nothing"),
            }
            return {
              ok: false,
              doneText:
                refusals[result.error] ?? t("refundBooking.failed"),
            }
          }
          return { ok: true, doneText: t("refundBooking.done") }
        },
      },
    },
    {
      definition: {
        name: "save_payment_method",
        description:
          "Add a way to pay the business outside the app, or change one (methodId from list_payment_methods; what is not given is kept). details are the instructions the customer sees after booking, in the owner's own words: never invent an account, email or number. Needs the owner's tap.",
        parameters: schema({
          methodId: {
            type: "string",
            description: "Id from list_payment_methods; omit to add",
          },
          type: { type: "string", enum: [...PAYMENT_TYPES] },
          name: { type: "string", description: "Short name, e.g. Zelle" },
          details: {
            type: "string",
            description: "Where and how to pay, as the owner said it",
          },
        }),
        needsConfirm: true,
        resultKind: "payments",
      },
      label: t("steps.savePaymentMethod"),
      doneLabel: t("stepsDone.savePaymentMethod"),
      run: async () => ({ error: t("tapFirst.savePaymentMethod") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkPaymentMethodArgs(args)
          if ("error" in checked) {
            return checked
          }
          const adding = checked.methodId === null
          return {
            title: t(`cards.savePaymentMethod.${adding ? "add" : "change"}`),
            action: t(`actions.savePaymentMethod.${adding ? "add" : "change"}`),
            summary: `${checked.values.name} · ${checked.values.details}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkPaymentMethodArgs(args)
          if ("error" in checked) {
            return { ok: false, doneText: checked.error }
          }
          const result = await savePaymentMethod(
            businessId,
            checked.methodId,
            checked.values
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("paymentMethod.failed", { error: result.error }),
            }
          }
          return {
            ok: true,
            doneText: t(
              `paymentMethod.${checked.methodId === null ? "added" : "changed"}`
            ),
          }
        },
      },
    },
    {
      definition: {
        name: "remove_payment_method",
        description:
          "Remove a way to pay. Use the id from list_payment_methods. Bookings already made with it keep their own copy. Needs the owner's tap.",
        parameters: schema(
          {
            methodId: {
              type: "string",
              description: "Id from list_payment_methods",
            },
          },
          ["methodId"]
        ),
        needsConfirm: true,
        resultKind: "payments",
      },
      label: t("steps.removePaymentMethod"),
      doneLabel: t("stepsDone.removePaymentMethod"),
      run: async () => ({ error: t("tapFirst.removePaymentMethod") }),
      confirm: {
        describe: async (args: unknown) => {
          const methodId = asRecord(args)?.methodId
          const { methods } = await getPaymentSettings(businessId)
          const method = methods.find((row) => row.id === methodId)
          if (!method) {
            return { error: t("errors.paymentMethodUnknown") }
          }
          return {
            title: t("cards.removePaymentMethod"),
            action: t("actions.removePaymentMethod"),
            summary: method.name,
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const methodId = asRecord(args)?.methodId
          if (typeof methodId !== "string" || methodId === "") {
            return { ok: false, doneText: t("paymentMethod.unknown") }
          }
          const result = await deletePaymentMethod(businessId, methodId)
          if (!result.ok) {
            return {
              ok: false,
              doneText:
                result.error === "not_found"
                  ? t("paymentMethod.unknown")
                  : t("paymentMethod.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("paymentMethod.removed") }
        },
      },
    },
    {
      definition: {
        name: "set_pay_at_visit",
        description:
          "Turn on or off whether customers may choose to pay at the visit instead of one of the ways to pay. Only matters when list_payment_methods lists a way. Needs the owner's tap.",
        parameters: schema({ on: { type: "boolean" } }, ["on"]),
        needsConfirm: true,
        resultKind: "payments",
      },
      label: t("steps.payAtVisit"),
      doneLabel: t("stepsDone.payAtVisit"),
      run: async () => ({ error: t("tapFirst.payAtVisit") }),
      confirm: {
        describe: async (args: unknown) => {
          const on = asRecord(args)?.on
          if (typeof on !== "boolean") {
            return { error: t("errors.onInvalid") }
          }
          const { payLater } = await getPaymentSettings(businessId)
          if (payLater === on) {
            return { error: t("errors.nothingToChange") }
          }
          const state = on ? "on" : "off"
          return {
            title: t(`cards.payAtVisit.${state}`),
            action: t(`actions.payAtVisit.${state}`),
            summary: t(`payAtVisit.summary.${state}`),
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const on = asRecord(args)?.on
          if (typeof on !== "boolean") {
            return {
              ok: false,
              doneText: t("payAtVisit.failed", { error: "invalid" }),
            }
          }
          const result = await setPayLater(businessId, on)
          return result.ok
            ? { ok: true, doneText: t(`payAtVisit.done.${on ? "on" : "off"}`) }
            : {
                ok: false,
                doneText: t("payAtVisit.failed", { error: result.error }),
              }
        },
      },
    },
    {
      definition: {
        name: "list_rewards",
        description:
          "The business's rewards: rules like \"every 5 visits, a free haircut\". Each has its id, on or off, earnsText and givesText (the words the owner sees) and its raw values; money is in minor units of the business currency. Also customersEarning, rewardsWaiting (earned, not redeemed yet) and rewardsUsed. Customers earn by booking and redeem on a later booking; the app never moves money.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t("steps.rewards"),
      doneLabel: t("stepsDone.rewards"),
      run: async () => {
        const [settings, { business }] = await Promise.all([
          rewardSettings(),
          getOwnerBusiness(businessId),
        ])
        if ("error" in settings) return settings
        return {
          rewards: settings.rules.map((rule) =>
            rewardRow(rule, settings.currency, business.timezone)
          ),
          customersEarning: settings.counts.earning,
          rewardsWaiting: settings.counts.waiting,
          rewardsUsed: settings.counts.used,
          max: REWARD_RULES.maxRules,
        }
      },
    },
    {
      definition: {
        name: "customer_rewards",
        description:
          "One customer's rewards, found by name or phone: their count on each reward (count of goal), the rewards they can redeem (onBooking = already on a booking still ahead) and the customerKey adjust_customer_visits needs.",
        parameters: schema(
          { query: { type: "string", description: "Name or phone text" } },
          ["query"]
        ),
        needsConfirm: false,
      },
      label: t("steps.customerRewards"),
      doneLabel: t("stepsDone.customerRewards"),
      run: async (args: unknown) => {
        const query = asRecord(args)?.query
        if (
          typeof query !== "string" ||
          query.trim().length === 0 ||
          query.length > ASSISTANT_RULES.maxCustomerQuery
        ) {
          return bad(
            t("errors.queryInvalid", {
              max: String(ASSISTANT_RULES.maxCustomerQuery),
            })
          )
        }
        const settings = await rewardSettings()
        if ("error" in settings) return settings
        const say = rewardWords(words.rewards, locale, settings.currency)
        const matched = customersMatching(
          await getCustomers(businessId),
          query
        )
        const capped = matched.slice(0, 5)
        const customers = await Promise.all(
          capped.map(async (customer) => {
            const mine = await getCustomerRewards(businessId, customer.key)
            return {
              name: customer.name,
              phone: customer.phone,
              customerKey: customer.key,
              progress: (mine?.rules ?? []).map(({ rule, balance }) => ({
                ruleId: rule.id,
                earnsText: say.earn(rule),
                givesText: say.prize(rule),
                earnType: rule.earnType,
                count: balance,
                goal: rule.goal,
                ...(rule.earnType === "spend"
                  ? {
                      countText: formatPrice(balance, settings.currency, locale),
                      goalText: formatPrice(rule.goal, settings.currency, locale),
                    }
                  : {}),
              })),
              rewards: (mine?.rewards ?? []).map((reward) => ({
                givesText: say.reward(reward.reward),
                onBooking: reward.held,
                expires: reward.expires,
                expiresText: dayText(locale, reward.expires),
              })),
            }
          })
        )
        return {
          customers,
          total: matched.length,
          truncated: matched.length > customers.length,
        }
      },
    },
    {
      definition: {
        name: "save_reward",
        description:
          "Add a reward, or change one (ruleId from list_rewards; what is not given is kept). Example \"after 5 visits, 1 free haircut\": earnType visit, goal 5, rewardType free, rewardServiceIds [the haircut's id]. Money is in minor units of the business currency. A new reward counts bookings from now on; a change never touches rewards already earned. Needs the owner's tap.",
        parameters: schema({
          ruleId: {
            type: "string",
            description: "Id from list_rewards; omit to add",
          },
          earnType: {
            type: "string",
            enum: [...REWARD_EARN_TYPES],
            description: "visit: each booking counts 1; spend: its price",
          },
          goal: {
            type: "integer",
            description: `Visits needed (1-${REWARD_RULES.maxGoalVisits}), or the amount to spend in minor units`,
          },
          earnServiceIds: {
            type: ["array", "null"],
            items: { type: "string" },
            description:
              "Ids from list_services whose bookings count; null = every service",
          },
          rewardType: {
            type: "string",
            enum: [...REWARD_TYPES],
            description:
              "free: the service is free; percent: a percent off; amount: a fixed amount off",
          },
          rewardValue: {
            type: ["integer", "null"],
            description:
              "The percent (1-100) or the amount in minor units; null for free",
          },
          rewardServiceIds: {
            type: ["array", "null"],
            items: { type: "string" },
            description:
              "Ids from list_services the reward can be used on; null = every service",
          },
          rewardCount: {
            type: "integer",
            description: `Bookings one earned reward covers, 1-${REWARD_RULES.maxCount}; 1 unless the owner says more ("get 2 free")`,
          },
          expiresDays: {
            type: ["integer", "null"],
            description: `Days an earned reward stays usable, 1-${REWARD_RULES.maxExpiresDays}; null = no limit`,
          },
          endsOn: {
            type: ["string", "null"],
            description:
              "Last day bookings count, YYYY-MM-DD, today or later; null = never ends",
          },
          maxPerCustomer: {
            type: ["integer", "null"],
            description: "Times one customer can earn it; null = no limit",
          },
          maxDiscountMinor: {
            type: ["integer", "null"],
            description:
              "The most one use takes off, in minor units; null = no cap",
          },
          earnMinPriceMinor: {
            type: ["integer", "null"],
            description:
              "Bookings under this price don't count, in minor units; null = any price",
          },
          paidOnly: {
            type: "boolean",
            description: "Only bookings the owner marked paid count",
          },
        }),
        needsConfirm: true,
        resultKind: "rewards",
      },
      label: t("steps.saveReward"),
      doneLabel: t("stepsDone.saveReward"),
      run: async () => ({ error: t("tapFirst.saveReward") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkRewardArgs(args)
          if ("error" in checked) {
            return checked
          }
          const adding = checked.ruleId === null
          return {
            title: t(`cards.saveReward.${adding ? "add" : "change"}`),
            action: t(`actions.saveReward.${adding ? "add" : "change"}`),
            summary: checked.summary,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkRewardArgs(args)
          if ("error" in checked) {
            return { ok: false, doneText: checked.error }
          }
          const result = await saveRewardRule(
            businessId,
            checked.ruleId,
            checked.form
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("reward.failed", { error: result.error }),
            }
          }
          return {
            ok: true,
            doneText: t(
              `reward.${checked.ruleId === null ? "added" : "changed"}`
            ),
          }
        },
      },
    },
    {
      definition: {
        name: "turn_reward_on_off",
        description:
          "Turn a reward on or off. Use the id from list_rewards. Off stops earning; rewards already earned stay usable. Needs the owner's tap.",
        parameters: schema(
          {
            ruleId: { type: "string", description: "Id from list_rewards" },
            on: { type: "boolean" },
          },
          ["ruleId", "on"]
        ),
        needsConfirm: true,
        resultKind: "rewards",
      },
      label: t("steps.rewardOnOff"),
      doneLabel: t("stepsDone.rewardOnOff"),
      run: async () => ({ error: t("tapFirst.rewardOnOff") }),
      confirm: {
        describe: async (args: unknown) => {
          const on = asRecord(args)?.on
          if (typeof on !== "boolean") {
            return { error: t("errors.onInvalid") }
          }
          const found = await rewardRule(args)
          if ("error" in found) return found
          if ((found.rule.status === "active") === on) {
            return { error: t("errors.nothingToChange") }
          }
          const say = rewardWords(words.rewards, locale, found.settings.currency)
          return {
            title: t(`cards.rewardOnOff.${on ? "on" : "off"}`),
            action: t(on ? "actions.turnOn" : "actions.turnOff"),
            summary: `${say.prize(found.rule)} · ${say.earn(found.rule)}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const a = asRecord(args)
          if (typeof a?.ruleId !== "string" || typeof a.on !== "boolean") {
            return { ok: false, doneText: t("reward.unknown") }
          }
          const result = await setRewardRuleOn(businessId, a.ruleId, a.on)
          if (!result.ok) {
            return {
              ok: false,
              doneText:
                result.error === "not_found"
                  ? t("reward.unknown")
                  : t("reward.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t(`reward.${a.on ? "on" : "off"}`) }
        },
      },
    },
    {
      definition: {
        name: "remove_reward",
        description:
          "Remove a reward. Use the id from list_rewards. Rewards customers already earned stay usable. Needs the owner's tap.",
        parameters: schema(
          { ruleId: { type: "string", description: "Id from list_rewards" } },
          ["ruleId"]
        ),
        needsConfirm: true,
        resultKind: "rewards",
      },
      label: t("steps.removeReward"),
      doneLabel: t("stepsDone.removeReward"),
      run: async () => ({ error: t("tapFirst.removeReward") }),
      confirm: {
        describe: async (args: unknown) => {
          const found = await rewardRule(args)
          if ("error" in found) return found
          const say = rewardWords(words.rewards, locale, found.settings.currency)
          return {
            title: t("cards.removeReward"),
            action: t("actions.removeReward"),
            summary: `${say.prize(found.rule)} · ${say.earn(found.rule)}`,
            destructive: true,
          }
        },
        execute: async (args: unknown) => {
          const ruleId = asRecord(args)?.ruleId
          if (typeof ruleId !== "string" || ruleId === "") {
            return { ok: false, doneText: t("reward.unknown") }
          }
          const result = await removeRewardRule(businessId, ruleId)
          if (!result.ok) {
            return {
              ok: false,
              doneText:
                result.error === "not_found"
                  ? t("reward.unknown")
                  : t("reward.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("reward.removed") }
        },
      },
    },
    {
      definition: {
        name: "adjust_customer_visits",
        description:
          "Add to a customer's count on a reward, or take from it (a negative amount): visits on a visit reward, minor units of money on a spend reward. Rewards are made or taken back as the new count says. customerKey comes from customer_rewards, ruleId from list_rewards; reason is why, in the owner's words: ask, never make it up. Needs the owner's tap.",
        parameters: schema(
          {
            ruleId: { type: "string", description: "Id from list_rewards" },
            customerKey: {
              type: "string",
              description: "customerKey from customer_rewards",
            },
            amount: {
              type: "integer",
              description: "How much to add; negative to remove; never 0",
            },
            reason: {
              type: "string",
              description: `Why, at most ${REWARD_RULES.maxNote} characters`,
            },
          },
          ["ruleId", "customerKey", "amount", "reason"]
        ),
        needsConfirm: true,
        resultKind: "customers",
      },
      label: t("steps.adjustVisits"),
      doneLabel: t("stepsDone.adjustVisits"),
      run: async () => ({ error: t("tapFirst.adjustVisits") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkAdjustArgs(args)
          if ("error" in checked) return checked
          const way = checked.adding ? "add" : "remove"
          return {
            title: t(`cards.adjustVisits.${way}`),
            action: t(`actions.adjustVisits.${way}`),
            summary: checked.summary,
            destructive: !checked.adding,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkAdjustArgs(args)
          if ("error" in checked) {
            return { ok: false, doneText: checked.error }
          }
          const result = await changeProgress(
            businessId,
            checked.change,
            "assistant"
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("reward.adjustFailed", { error: result.error }),
            }
          }
          return {
            ok: true,
            doneText:
              result.earned > 0
                ? t("reward.adjustedEarned", { count: result.earned })
                : t("reward.adjusted"),
          }
        },
      },
    },
    {
      definition: {
        name: "change_theme",
        description:
          "Change the look of the public page. Only a theme that is ready can be turned on; for the others it answers that they are coming soon. Needs the owner's tap.",
        parameters: schema(
          {
            theme: { type: "string", enum: THEMES.map((theme) => theme.id) },
          },
          ["theme"]
        ),
        needsConfirm: true,
        resultKind: "theme",
      },
      label: t("steps.theme"),
      doneLabel: t("stepsDone.theme"),
      run: async () => ({ error: t("tapFirst.theme") }),
      confirm: {
        describe: async (args: unknown) => {
          const wanted = asRecord(args)?.theme
          const theme = THEMES.find((row) => row.id === wanted)
          const ready = THEMES.filter((row) => row.available)
            .map((row) => row.name)
            .join(", ")
          if (!theme) {
            return {
              error: t("errors.themeUnknown", { names: THEMES.map((row) => row.id).join(", ") }),
            }
          }
          if (!theme.available) {
            return { error: t("errors.themeComingSoon", { name: theme.name, ready }) }
          }
          const { business } = await getOwnerBusiness(businessId)
          if (business.theme === theme.id) {
            return { error: t("errors.nothingToChange") }
          }
          const now = THEMES.find((row) => row.id === business.theme)
          return {
            title: t("cards.theme"),
            action: t("actions.theme"),
            summary: `${now?.name ?? business.theme} → ${theme.name}`,
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const result = await activateTheme(
            businessId,
            String(asRecord(args)?.theme)
          )
          return result.ok
            ? { ok: true, doneText: t("theme.done") }
            : { ok: false, doneText: t("theme.failed", { error: result.error }) }
        },
      },
    },
    {
      definition: {
        name: "whatsapp_settings",
        description:
          "WhatsApp: reminder settings and the reminder times that can be picked, each message with its name, on or off, whether its wording can be edited, its wording per language and Meta's review, and the automations with their ids.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t("steps.whatsapp"),
      doneLabel: t("stepsDone.whatsapp"),
      run: async () => {
        const [settings, rules, messages, automations] = await Promise.all([
          notificationSettingsFor(businessId),
          notificationRules(businessId),
          notificationMessagesFor(businessId),
          automationsFor(businessId),
        ])
        return {
          settings: {
            ownerPhone: settings.ownerPhone,
            ownerLanguage: settings.ownerLanguage,
            reminders: settings.reminders,
            remindersText: settings.reminders.map(formatDuration),
            quietStart: settings.quietStart,
            quietEnd: settings.quietEnd,
            quietStartText: formatClock(settings.quietStart, locale),
            quietEndText: formatClock(settings.quietEnd, locale),
            freeTextInWindow: settings.freeTextInWindow,
            cantCome: settings.cantCome,
            thankYouReply: settings.thankYouReply,
          },
          reminderChoices: rules.reminderChoices,
          maxReminders: rules.maxReminders,
          messages: messages.map((item) => ({
            message: item.message,
            name: ownerT(`whatsapp.names.${item.message}`),
            on: item.on,
            editable: item.editable,
            fields: messageFields(item.message),
            texts: Object.fromEntries(
              TEMPLATE_LANGUAGES.map((language) => [
                language,
                {
                  ...item.texts[language].wording,
                  buttons: item.texts[language].buttons,
                  isDefault: item.texts[language].isDefault,
                  review: item.texts[language].review,
                },
              ])
            ),
          })),
          automations: automations.map((row) => ({
            id: row.id,
            name: ownerT(`whatsapp.flows.names.${row.trigger}`),
            on: row.on,
          })),
        }
      },
    },
    {
      definition: {
        name: "turn_message_on_off",
        description:
          "Turn one WhatsApp message on or off. Needs the owner's tap.",
        parameters: schema(
          {
            message: { type: "string", enum: [...BOOKING_MESSAGES] },
            on: { type: "boolean" },
          },
          ["message", "on"]
        ),
        needsConfirm: true,
        resultKind: "messages",
      },
      label: t("steps.messageOn"),
      doneLabel: t("stepsDone.messageOn"),
      run: async () => ({ error: t("tapFirst.messageOn") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkMessageOnArgs(args)
          if ("error" in checked) {
            return checked
          }
          return {
            title: checked.on ? t("cards.messageOn") : t("cards.messageOff"),
            action: checked.on ? t("actions.turnOn") : t("actions.turnOff"),
            summary: ownerT(`whatsapp.names.${checked.message}`),
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const a = asRecord(args)
          const message = a?.message as BookingMessage
          const result = await setMessageOn(
            businessId,
            message,
            a?.on as boolean
          )
          if (!result.ok) {
            return { ok: false, doneText: t("messageOn.failed", { error: result.error }) }
          }
          const name = ownerT(`whatsapp.names.${message}`)
          return {
            ok: true,
            doneText: a?.on ? t("messageOn.on", { name }) : t("messageOn.off", { name }),
          }
        },
      },
    },
    {
      definition: {
        name: "save_reminder_settings",
        description:
          "Change WhatsApp reminder settings; only the given fields change. Read them with whatsapp_settings first. reminders replaces the whole list, in minutes before the visit. ownerPhone is the owner's own WhatsApp for alerts, null for none. Quiet hours are HH:mm. freeTextInWindow sends a normal message inside 24 hours of the person's last message. cantCome is what a customer's 'Can't make it' does. Needs the owner's tap.",
        parameters: schema({
          ownerPhone: { type: ["string", "null"] },
          ownerLanguage: { type: "string", enum: [...TEMPLATE_LANGUAGES] },
          reminders: { type: "array", items: { type: "integer" } },
          quietStart: { type: "string" },
          quietEnd: { type: "string" },
          freeTextInWindow: { type: "boolean" },
          cantCome: { type: "string", enum: ["cancel", "alertOnly"] },
          thankYouReply: { type: "boolean" },
        }),
        needsConfirm: true,
        resultKind: "timing",
      },
      label: t("steps.reminderSettings"),
      doneLabel: t("stepsDone.reminderSettings"),
      run: async () => ({ error: t("tapFirst.reminderSettings") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkReminderSettingsArgs(args)
          if ("error" in checked) {
            return checked
          }
          const { current, next } = checked
          const onOff = (value: boolean) => (value ? t("reminderSettings.on") : t("reminderSettings.off"))
          const reminders = (list: number[]) =>
            list.length > 0 ? list.map(formatDuration).join(", ") : t("reminderSettings.none")
          const rows: [string, string, string][] = [
            [
              t("reminderSettings.fields.ownerPhone"),
              current.ownerPhone ?? t("reminderSettings.none"),
              next.ownerPhone ?? t("reminderSettings.none"),
            ],
            [
              t("reminderSettings.fields.ownerLanguage"),
              t(`reminderSettings.languages.${current.ownerLanguage}`),
              t(`reminderSettings.languages.${next.ownerLanguage}`),
            ],
            [
              t("reminderSettings.fields.reminders"),
              reminders(current.reminders),
              reminders(next.reminders),
            ],
            [
              t("reminderSettings.fields.quietStart"),
              formatClock(current.quietStart, locale),
              formatClock(next.quietStart, locale),
            ],
            [
              t("reminderSettings.fields.quietEnd"),
              formatClock(current.quietEnd, locale),
              formatClock(next.quietEnd, locale),
            ],
            [
              t("reminderSettings.fields.freeTextInWindow"),
              onOff(current.freeTextInWindow),
              onOff(next.freeTextInWindow),
            ],
            [
              t("reminderSettings.fields.cantCome"),
              t(`reminderSettings.cantCome.${current.cantCome}`),
              t(`reminderSettings.cantCome.${next.cantCome}`),
            ],
            [
              t("reminderSettings.fields.thankYouReply"),
              onOff(current.thankYouReply),
              onOff(next.thankYouReply),
            ],
          ]
          const parts = rows
            .filter(([, before, after]) => before !== after)
            .map(([label, before, after]) => `${label} · ${before} → ${after}`)
          if (parts.length === 0) {
            return { error: t("errors.nothingToChange") }
          }
          return {
            title: t("cards.reminderSettings"),
            action: t("actions.reminderSettings"),
            summary: parts.join(" · "),
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkReminderSettingsArgs(args)
          if ("error" in checked) {
            return {
              ok: false,
              doneText: t("reminderSettings.failed", { error: checked.error }),
            }
          }
          const result = await saveNotificationSettings(
            businessId,
            checked.next
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("reminderSettings.failed", { error: result.error }),
            }
          }
          return { ok: true, doneText: t("reminderSettings.done") }
        },
      },
    },
    {
      definition: {
        name: "change_message_wording",
        description:
          "Change a WhatsApp message in one language: only the given parts change. Read it with whatsapp_settings first. body may use the fields listed there, like {name}. useDefault goes back to the original wording. This saves a draft and sends nothing to Meta: the owner submits it on the Messages page. Needs the owner's tap.",
        parameters: schema(
          {
            message: { type: "string", enum: [...BOOKING_MESSAGES] },
            language: { type: "string", enum: [...TEMPLATE_LANGUAGES] },
            header: { type: "string" },
            body: { type: "string" },
            footer: { type: "string" },
            buttons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: {
                    type: "string",
                    enum: ["confirm", "cantCome", "ok"],
                  },
                  label: { type: "string" },
                },
                required: ["action", "label"],
                additionalProperties: false,
              },
            },
            useDefault: { type: "boolean" },
          },
          ["message", "language"]
        ),
        needsConfirm: true,
        resultKind: "messages",
      },
      label: t("steps.messageWording"),
      doneLabel: t("stepsDone.messageWording"),
      run: async () => ({ error: t("tapFirst.messageWording") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkWordingArgs(args)
          if ("error" in checked) {
            return checked
          }
          const { item, language, wording, buttons, defaults } = checked
          const name = `${ownerT(`whatsapp.names.${item.message}`)} · ${t(`messageWording.languages.${language}`)}`
          if (!wording) {
            return {
              title: t("cards.messageReset"),
              action: t("actions.messageReset"),
              summary: name,
              destructive: true,
            }
          }
          const shown = buttons ?? defaults
          return {
            title: t("cards.messageWording"),
            action: t("actions.messageWording"),
            summary: [
              name,
              wording.header,
              wording.body,
              wording.footer,
              shown.map((button) => button.label).join(", "),
              t("messageWording.draftNote"),
            ]
              .filter((part) => part !== "")
              .join(" · "),
            destructive: false,
          }
        },
        // Nothing here goes to Meta: submitting stays the owner's own step.
        execute: async (args: unknown) => {
          const checked = await checkWordingArgs(args)
          if ("error" in checked) {
            return {
              ok: false,
              doneText: t("messageWording.failed", { error: checked.error }),
            }
          }
          const { item, language, wording, buttons } = checked
          const result = await saveMessageWording(
            businessId,
            item.message,
            language,
            wording,
            buttons
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText: t("messageWording.failed", { error: result.error }),
            }
          }
          return {
            ok: true,
            doneText: wording
              ? t("messageWording.done")
              : t("messageWording.resetDone"),
          }
        },
      },
    },
    {
      definition: {
        name: "turn_automation_on_off",
        description:
          "Turn a WhatsApp automation on or off. Use the id from whatsapp_settings. Turning one on needs the business's own WhatsApp number. Needs the owner's tap.",
        parameters: schema(
          {
            automationId: {
              type: "string",
              description: "Id from whatsapp_settings",
            },
            on: { type: "boolean" },
          },
          ["automationId", "on"]
        ),
        needsConfirm: true,
        resultKind: "flows",
      },
      label: t("steps.automationOn"),
      doneLabel: t("stepsDone.automationOn"),
      run: async () => ({ error: t("tapFirst.automationOn") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkAutomationArgs(args)
          if ("error" in checked) {
            return checked
          }
          return {
            title: checked.on ? t("cards.automationOn") : t("cards.automationOff"),
            action: checked.on ? t("actions.turnOn") : t("actions.turnOff"),
            summary: ownerT(`whatsapp.flows.names.${checked.automation.trigger}`),
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkAutomationArgs(args)
          if ("error" in checked) {
            return {
              ok: false,
              doneText:
                checked.error === t("errors.automationUnknown") ||
                checked.error === t("errors.automationIdRequired")
                  ? t("automationOn.unknown")
                  : t("automationOn.failed", { error: checked.error }),
            }
          }
          const result = await setAutomationOn(
            businessId,
            checked.automation.id,
            checked.on
          )
          if (!result.ok) {
            return {
              ok: false,
              doneText:
                result.error === "noOwnNumber"
                  ? t("automationOn.noOwnNumber")
                  : result.error === "not_found"
                    ? t("automationOn.unknown")
                    : t("automationOn.failed", { error: result.error }),
            }
          }
          const name =
            ownerT(`whatsapp.flows.names.${checked.automation.trigger}`)
          return {
            ok: true,
            doneText: checked.on
              ? t("automationOn.on", { name })
              : t("automationOn.off", { name }),
          }
        },
      },
    },
    // Email (docs/plans/email.md, EM-12): the Email page's switches and
    // history, as the owner sees them.
    {
      definition: {
        name: "email_settings",
        description:
          "Booking emails: each one with its name, who gets it (the customer or the owner) and whether it is on. Emails go only to bookings with an email address; reminders go by email when the customer can't get WhatsApp or picked email.",
        parameters: schema({}),
        needsConfirm: false,
      },
      label: t("steps.email"),
      doneLabel: t("stepsDone.email"),
      run: async () => {
        const { emailTurnedOff } = await notificationSettingsFor(businessId)
        return {
          emails: BOOKING_EMAILS.map((email) => ({
            email,
            name: ownerT(`email.names.${email}`),
            to: (CUSTOMER_EMAILS as readonly string[]).includes(email) ? "customer" : "owner",
            on: !emailTurnedOff.includes(email),
          })),
        }
      },
    },
    {
      definition: {
        name: "email_history",
        description:
          "The latest booking emails, newest first: which, to whom, when it went or goes, and its status (scheduled, sent, delivered, bounced, failed, not sent) with why it was not sent. Narrow by email, status, or a customer's name or address.",
        parameters: schema({
          email: { type: "string", enum: [...BOOKING_EMAILS] },
          state: { type: "string", enum: [...EMAIL_ACTIVITY_STATES] },
          search: { type: "string", description: "Customer name or email address" },
        }),
        needsConfirm: false,
      },
      label: t("steps.emailHistory"),
      doneLabel: t("stepsDone.emailHistory"),
      run: async (args: unknown) => {
        const a = asRecord(args)
        const email = isBookingEmail(a?.email) ? a.email : undefined
        const state = EMAIL_ACTIVITY_STATES.find((item) => item === a?.state)
        const search = typeof a?.search === "string" ? a.search.trim() || undefined : undefined
        const [{ business }, rules] = await Promise.all([
          getOwnerBusiness(businessId),
          notificationRules(businessId),
        ])
        const rows = await emailActivity(
          { businessId, kinds: BOOKING_EMAILS },
          { kind: email, state, search },
          rules.historySize
        )
        const when = new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: business.timezone,
        })
        return {
          total: rows.length,
          // The list stops at the latest `historySize`.
          truncated: rows.length === rules.historySize,
          emails: rows.flatMap((row) =>
            isBookingEmail(row.kind)
              ? [
                  {
                    email: row.kind,
                    name: ownerT(`email.names.${row.kind}`),
                    to: row.email,
                    customerName: row.customerName,
                    at: row.at,
                    whenText: when.format(new Date(row.at)),
                    status: ownerT(
                      `email.states.${row.state === "sent" && row.delivery ? row.delivery : row.state}`
                    ),
                    reason: row.reason ? ownerT(`email.reasons.${row.reason}`) : null,
                  },
                ]
              : []
          ),
        }
      },
    },
    {
      definition: {
        name: "turn_email_on_off",
        description:
          "Turn one booking email on or off. An email turned off is not sent and shows as not sent in the history. Needs the owner's tap.",
        parameters: schema(
          {
            email: { type: "string", enum: [...BOOKING_EMAILS] },
            on: { type: "boolean" },
          },
          ["email", "on"]
        ),
        needsConfirm: true,
        resultKind: "emails",
      },
      label: t("steps.emailOn"),
      doneLabel: t("stepsDone.emailOn"),
      run: async () => ({ error: t("tapFirst.emailOn") }),
      confirm: {
        describe: async (args: unknown) => {
          const checked = await checkEmailOnArgs(args)
          if ("error" in checked) {
            return checked
          }
          return {
            title: checked.on ? t("cards.emailOn") : t("cards.emailOff"),
            action: checked.on ? t("actions.turnOn") : t("actions.turnOff"),
            summary: ownerT(`email.names.${checked.email}`),
            destructive: false,
          }
        },
        execute: async (args: unknown) => {
          const checked = await checkEmailOnArgs(args)
          if ("error" in checked) {
            return { ok: false, doneText: checked.error }
          }
          const result = await setEmailOn(businessId, checked.email, checked.on)
          if (!result.ok) {
            return { ok: false, doneText: t("emailOn.failed", { error: result.error }) }
          }
          const name = ownerT(`email.names.${checked.email}`)
          return {
            ok: true,
            doneText: checked.on ? t("emailOn.on", { name }) : t("emailOn.off", { name }),
          }
        },
      },
    },
  ]
}
