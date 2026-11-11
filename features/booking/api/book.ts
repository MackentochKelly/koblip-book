import "server-only"

import { and, asc, eq, gte, lte } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { newBookingClaim } from "@/lib/booking-claim"
import { customerKey } from "@/lib/customer-key"
import { getSession } from "@/lib/dal"
import { internationalPhone } from "@/lib/whatsapp-phone"
import {
  BOOKING_RULES,
  EMAIL_PATTERN,
  PHONE_PATTERN,
} from "@/lib/booking-rules"
import { db } from "@/lib/db"
import { googleBusyTimes } from "@/lib/google-calendar-busy"
import { requestGoogleSync } from "@/lib/google-calendar-sync"
import { saveAll } from "@/lib/db/save-all"
import { offersWhatsapp } from "@/lib/whatsapp-offer"
import { notification } from "@/lib/in-app-notifications"
import { paymentMethodsFor } from "@/lib/payment-methods"
import { cardPayFor } from "@/lib/stripe-connect"
import { deleteProof, saveProof } from "@/lib/payment-proofs"
import {
  cardAmount,
  CARD_METHOD,
  CARD_TYPE,
  ONLINE_PAY_RULES,
  startPayment,
  type BookingPayment,
} from "@/lib/payment-rules"
import { totalWithReward } from "@/lib/reward-rules"
import { holdRewardWrite, rewardToRedeem } from "@/lib/rewards"
import { DEFAULT_LANGUAGE, isPageLanguage } from "@/lib/page-language"
import {
  bookingAddons,
  bookingHolds,
  bookings,
  businessHours,
  businessPolicies,
  businessPolicyPoints,
  businesses,
  services,
  teamMemberHours,
  teamMemberServices,
  teamMembers,
} from "@/lib/db/schema"
import type { BookingInput, BookingResult } from "../types"
import { workingMemberIds, availability } from "../utils/availability"
import { checkAddons } from "../utils/addons"
import { isBookable } from "../utils/is-bookable"
import { loadGroupsForService } from "./addon-groups"
import { inBookingTurn } from "./booking-turn"
import { heldTimes } from "./holds"
import {
  allowedServiceMemberIds,
  firstFreeMember,
} from "../utils/service-members"
import { addDays, zonedInstant } from "../utils/zoned-time"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number)
  return hour * 60 + minute
}

async function hasPolicies(businessId: string): Promise<boolean> {
  const [[text], [point]] = await Promise.all([
    db
      .select({ id: businessPolicies.id })
      .from(businessPolicies)
      .where(eq(businessPolicies.businessId, businessId))
      .limit(1),
    db
      .select({ id: businessPolicyPoints.id })
      .from(businessPolicyPoints)
      .where(eq(businessPolicyPoints.businessId, businessId))
      .limit(1),
  ])
  return Boolean(text || point)
}

// The three ways a customer's booking is made
// (docs/plans/online-payments.md, ON7):
// book: at once, as always. Never with the card as its way to pay.
// hold: the customer pays by card. Everything is checked as for a booking,
// then the time is held (booking_holds) instead of booked.
// paid: Stripe says the hold was paid: its booking is made, with what
// Stripe took. The hold is its yes to the time, so free times are not
// asked again.
export type BookMode =
  | { kind: "book" }
  | { kind: "hold" }
  | {
      kind: "paid"
      hold: typeof bookingHolds.$inferSelect
      paidMinor: number
      sessionId: string
      paymentId: string | null
    }

// A time held for a card payment, for the payment page to be made from.
export interface HeldBooking {
  holdId: string
  bookingId: string
  businessId: string
  businessName: string
  stripeAccountId: string
  serviceName: string
  amountMinor: number
  currency: string
  // Signed out: the one-time secret that joins the booking to an account.
  claimToken: string | null
}

export type BookOutcome = BookingResult | { status: "held"; hold: HeldBooking }

// Makes a customer's booking, or holds its time (see BookMode). Not a
// server action: a browser reaches it only through createBooking and
// startCardPayment, and Stripe's answer through finishCardPayment.
// No sign-in needed for customers: signed in, the booking is the account's
// (My bookings); signed out, it gets a claim for the account logged in
// after it. Every unexpected error becomes "failed".
// proof: the form's "file", the payment proof. A business that asks for it
// is booked with a way to pay now only once it is added: the booking then
// starts as "reported", for the business to check
// (docs/plans/payment-proof.md, PP10).
export async function book(
  input: BookingInput,
  proof: FormData | undefined,
  mode: BookMode
): Promise<BookOutcome> {
  // The proof saved for this booking; deleted again unless it is booked.
  let savedProof: string | null = null
  try {
    const name = input.name.trim()
    if (name.length < 1 || name.length > BOOKING_RULES.maxCustomerName) {
      return { status: "invalid", field: "name" }
    }
    const phone = input.phone.trim()
    if (!PHONE_PATTERN.test(phone)) {
      return { status: "invalid", field: "phone" }
    }
    // A card payment started before the form asked for an email has none.
    const email = (input.email ?? "").trim().toLowerCase()
    if (
      !(mode.kind === "paid" && !email) &&
      (email.length > BOOKING_RULES.maxCustomerEmail ||
        !EMAIL_PATTERN.test(email))
    ) {
      return { status: "invalid", field: "email" }
    }
    if (!DATE_PATTERN.test(input.date) || !TIME_PATTERN.test(input.time)) {
      return { status: "invalid", field: "time" }
    }

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.slug, input.slug))
      .limit(1)
    if (!business) {
      return { status: "failed" }
    }
    const whatsapp = await offersWhatsapp(business.id)
    // A business with policies is booked only once they are agreed to.
    const withPolicies = await hasPolicies(business.id)
    if (withPolicies && input.acceptedPolicies !== true) {
      return { status: "invalid", field: "policies" }
    }
    // A business with ways to pay outside the app is booked only with one
    // of them chosen (or paying later, where it allows that). The booking
    // starts unpaid whatever was sent: only the business marks it paid.
    // The card, where the business takes it, is one more way.
    const card = await cardPayFor(business)
    const methods = await paymentMethodsFor(business.id)

    const [serviceRows, hourRows, teamRows, linkRows, memberHourRows] =
      await Promise.all([
        db.select().from(services).where(eq(services.businessId, business.id)),
        db
          .select()
          .from(businessHours)
          .where(eq(businessHours.businessId, business.id)),
        db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.businessId, business.id))
          .orderBy(asc(teamMembers.position)),
        db
          .select()
          .from(teamMemberServices)
          .where(eq(teamMemberServices.businessId, business.id)),
        db
          .select()
          .from(teamMemberHours)
          .where(eq(teamMemberHours.businessId, business.id)),
      ])

    if (
      !isBookable({
        status: business.status,
        servicesCount: serviceRows.length,
        hoursCount: hourRows.length,
      })
    ) {
      return { status: "failed" }
    }

    const service = serviceRows.find((row) => row.id === input.serviceId)
    if (!service) {
      return { status: "invalid", field: "service" }
    }
    const addonCheck = checkAddons(
      await loadGroupsForService(business.id, service.id),
      input.addonIds
    )
    if (!addonCheck.ok) {
      return { status: "invalid", field: "addons" }
    }
    const totalMinutes = service.durationMinutes + addonCheck.extraMinutes
    const totalPrice =
      service.priceMinor === null
        ? addonCheck.extraPriceMinor
        : service.priceMinor + (addonCheck.extraPriceMinor ?? 0)
    const allowedIds = allowedServiceMemberIds(
      teamRows.map((row) => row.id),
      linkRows,
      service.id
    )
    const allowedRows = teamRows.filter((row) => allowedIds.includes(row.id))
    const member =
      input.teamMemberId === null
        ? null
        : (teamRows.find((row) => row.id === input.teamMemberId) ?? null)
    if (
      input.teamMemberId !== null &&
      (!member || !allowedIds.includes(member.id))
    ) {
      return { status: "invalid", field: "teamMember" }
    }

    const startInstant = zonedInstant(
      input.date,
      toMinutes(input.time),
      business.timezone
    )
    const endInstant = startInstant + totalMinutes * 60_000

    // Whose booking it is on My bookings (a demo guest isn't anyone yet).
    // A paid hold already knows: Stripe's answer comes with no session.
    const session = mode.kind === "paid" ? null : await getSession()
    const owner =
      mode.kind === "paid"
        ? mode.hold.customerUserId
        : session && !session.isGuest
          ? session.userId
          : null
    const claim: { token: string | null; hash: string } | null =
      mode.kind === "paid"
        ? mode.hold.claimTokenHash
          ? { token: null, hash: mode.hold.claimTokenHash }
          : null
        : owner
          ? null
          : newBookingClaim()
    // A reward to redeem (docs/plans/rewards.md, RW7): only the signed-in
    // customer's own, found by the phone their sign-in code proved, never
    // by the phone typed in the form. It takes off the service's price,
    // not its extras.
    const rewardOwner =
      mode.kind === "paid"
        ? mode.hold.rewardCustomerKey
        : owner && session?.phone
          ? customerKey(session.phone, "")
          : null
    let reward: { id: string; discountMinor: number } | null = null
    if (input.rewardId) {
      reward = rewardOwner
        ? await rewardToRedeem({
            businessId: business.id,
            rewardId: input.rewardId,
            customerKey: rewardOwner,
            service,
          })
        : null
      if (!reward) {
        return { status: "invalid", field: "reward" }
      }
    }
    const priceToPay = reward
      ? totalWithReward(totalPrice, reward.discountMinor)
      : totalPrice
    // A booking its reward made free has nothing to pay: no way to pay is
    // asked for and no proof (RW12). Any other booking needs its choice.
    const free = reward !== null && priceToPay === 0
    // What the card would be charged for this booking; null when it
    // cannot be (no card, no fixed price, or under Stripe's smallest
    // charge): the card is then no way to pay for it.
    const cardCharge =
      card && priceToPay !== null
        ? cardAmount(card, priceToPay, business.currency)
        : null
    const started = startPayment(
      methods,
      business.payLater,
      input.payment,
      cardCharge !== null
    )
    let payment: BookingPayment | null
    // What the card is to be charged, when the time is being held for it.
    let toCharge: number | null = null
    if (mode.kind === "paid") {
      // Stripe took the money: the booking is made whatever the business
      // offers by now, with what the card paid.
      payment = {
        choice: "now",
        method: CARD_METHOD,
        status: mode.paidMinor >= (priceToPay ?? 0) ? "paid" : "unpaid",
        reference: null,
        hasProof: false,
        online: { paidMinor: mode.paidMinor, refundedMinor: 0 },
      }
    } else {
      if (!free && !started.ok) {
        return { status: "invalid", field: "payment" }
      }
      payment = !free && started.ok ? started.payment : null
      // The card is paid on Stripe's page while the time is held, never
      // booked straight; and a hold is only ever for the card.
      const byCard = payment?.method?.type === CARD_TYPE
      if (byCard !== (mode.kind === "hold")) {
        return { status: "invalid", field: "payment" }
      }
      if (mode.kind === "hold") {
        toCharge = cardCharge
        if (toCharge === null || !business.stripeAccountId) {
          return { status: "invalid", field: "payment" }
        }
      }
    }
    // Everything else is in order: now the proof is kept.
    if (
      mode.kind === "book" &&
      business.paymentProof &&
      payment?.choice === "now"
    ) {
      const saved = await saveProof(
        proof instanceof FormData ? proof.get("file") : null
      )
      if (!saved.ok) {
        return { status: "invalid", field: "proof", error: saved.error }
      }
      savedProof = saved.name
    }
    const reportedAt = savedProof ? new Date(Date.now()).toISOString() : null
    // With its proof, the booking says "paid, please check" from the start.
    const startedPayment =
      payment && savedProof
        ? { ...payment, status: "reported" as const, hasProof: true }
        : payment
    // Set inside the turn when the reward was used elsewhere meanwhile.
    let rewardGone = false
    // Set inside the turn when the time was held rather than booked.
    let held: HeldBooking | null = null
    const confirmation = await inBookingTurn(business.id, async () => {
      // Read again inside the turn: nothing else takes the reward now.
      if (
        reward &&
        rewardOwner &&
        !(await rewardToRedeem({
          businessId: business.id,
          rewardId: reward.id,
          customerKey: rewardOwner,
          service,
        }))
      ) {
        rewardGone = true
        return null
      }
      const dayStart = zonedInstant(input.date, 0, business.timezone)
      const dayEnd = zonedInstant(addDays(input.date, 1), 0, business.timezone)
      if (mode.kind === "paid") {
        // The hold must still be there: its booking is made once.
        const [still] = await db
          .select({ id: bookingHolds.id })
          .from(bookingHolds)
          .where(eq(bookingHolds.id, mode.hold.id))
          .limit(1)
        if (!still) return null
      }
      const booked = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.businessId, business.id),
            eq(bookings.status, "confirmed"),
            gte(
              bookings.startAt,
              new Date(dayStart - 86_400_000).toISOString()
            ),
            lte(bookings.startAt, new Date(dayEnd + 86_400_000).toISOString())
          )
        )
      // A time another customer is paying for is busy too.
      const taken = [
        ...booked,
        ...(await heldTimes(
          business.id,
          mode.kind === "paid" ? mode.hold.id : undefined
        )),
      ]
      const busy = await googleBusyTimes(
        business.id,
        new Date(dayStart - 86_400_000).toISOString(),
        new Date(dayEnd + 86_400_000).toISOString()
      )

      const [day] = availability({
        hours: hourRows,
        memberHours: memberHourRows,
        timeZone: business.timezone,
        durationMinutes: totalMinutes,
        seats: business.seats,
        teamMemberIds:
          input.teamMemberId !== null ? [input.teamMemberId] : allowedIds,
        taken,
        busy,
        now: Date.now(),
        dates: [input.date],
      })
      // A paid hold kept its time: it is not asked for again (the rules on
      // booking ahead were met when it was held).
      if (mode.kind !== "paid" && !day.times.includes(input.time)) {
        return null
      }

      let teamMemberId: string | null = input.teamMemberId
      let teamMemberName: string | null = member?.name ?? null
      if (mode.kind === "paid") {
        teamMemberId = mode.hold.teamMemberId
        teamMemberName =
          teamRows.find((row) => row.id === teamMemberId)?.name ?? null
      } else if (teamMemberId === null && allowedRows.length > 0) {
        const free = firstFreeMember(
          allowedRows.filter(
            (row) =>
              workingMemberIds(
                hourRows,
                memberHourRows,
                [row.id],
                input.date,
                toMinutes(input.time),
                totalMinutes
              ).length > 0
          ),
          // A team member busy in Google is not free either.
          [...taken, ...busy],
          startInstant,
          endInstant
        )
        if (!free) {
          return null
        }
        teamMemberId = free.id
        teamMemberName = free.name
      }

      const startAt = new Date(startInstant).toISOString()
      if (mode.kind === "hold" && toCharge !== null && business.stripeAccountId) {
        // The time is held, not booked: the booking is made when Stripe
        // says the card paid (finishCardPayment).
        const holdId = crypto.randomUUID()
        const bookingId = crypto.randomUUID()
        await db.insert(bookingHolds).values({
          id: holdId,
          businessId: business.id,
          bookingId,
          input: { ...input, name, phone },
          startAt,
          endAt: new Date(endInstant).toISOString(),
          teamMemberId,
          amountMinor: toCharge,
          currency: business.currency,
          customerUserId: owner,
          rewardCustomerKey: reward ? rewardOwner : null,
          claimTokenHash: claim?.hash ?? null,
          expiresAt: new Date(
            Date.now() +
              (ONLINE_PAY_RULES.holdMinutes + ONLINE_PAY_RULES.holdGraceMinutes) *
                60_000
          ).toISOString(),
        })
        held = {
          holdId,
          bookingId,
          businessId: business.id,
          businessName: business.name,
          stripeAccountId: business.stripeAccountId,
          serviceName: service.name,
          amountMinor: toCharge,
          currency: business.currency,
          claimToken: claim?.token ?? null,
        }
        return null
      }
      const bookingId =
        mode.kind === "paid" ? mode.hold.bookingId : crypto.randomUUID()
      // The owner's bell hears of it, saved with the booking.
      const notice = await notification(
        business.id,
        "newBooking",
        { customerName: name, serviceName: service.name, startAt },
        { dedupeKey: `booking:${bookingId}` }
      )
      // And, with a proof, that there is a payment to check.
      const paidNotice = savedProof
        ? await notification(
            business.id,
            "customerPaid",
            { customerName: name, serviceName: service.name, startAt },
            { dedupeKey: `paid:${bookingId}` }
          )
        : []
      await saveAll([
        db.insert(bookings).values({
          id: bookingId,
          businessId: business.id,
          serviceId: service.id,
          teamMemberId,
          serviceName: service.name,
          teamMemberName,
          durationMinutes: totalMinutes,
          priceMinor: priceToPay,
          rewardId: reward?.id ?? null,
          rewardDiscountMinor: reward?.discountMinor ?? null,
          currency: business.currency,
          startAt,
          endAt: new Date(endInstant).toISOString(),
          customerName: name,
          customerPhone: internationalPhone(phone, business),
          customerEmail: email || null,
          customerKey: customerKey(internationalPhone(phone, business), name),
          customerUserId: owner,
          claimTokenHash: claim?.hash ?? null,
          // The booking page names the business in the ⓘ on Phone whenever
          // it sends WhatsApp booking messages: booking is the yes.
          whatsappOptIn: whatsapp,
          policiesAcceptedAt: withPolicies ? new Date(Date.now()).toISOString() : null,
          paymentChoice: payment?.choice ?? null,
          paymentMethod: payment?.method ?? null,
          paymentStatus: startedPayment?.status ?? null,
          paymentReportedAt: reportedAt,
          paymentProof: savedProof,
          ...(mode.kind === "paid"
            ? {
                paymentPaidAt:
                  startedPayment?.status === "paid"
                    ? new Date(Date.now()).toISOString()
                    : null,
                paidOnlineMinor: mode.paidMinor,
                stripeSessionId: mode.sessionId,
                stripePaymentId: mode.paymentId,
              }
            : {}),
          language: isPageLanguage(input.language) ? input.language : DEFAULT_LANGUAGE,
        }),
        ...(addonCheck.options.length > 0
          ? [
              db.insert(bookingAddons).values(
                addonCheck.options.map((option, index) => ({
                  businessId: business.id,
                  bookingId,
                  optionId: option.id,
                  name: option.name,
                  priceMinor: option.priceMinor,
                  durationMinutes: option.durationMinutes,
                  position: index,
                }))
              ),
            ]
          : []),
        ...(reward ? [holdRewardWrite(reward.id)] : []),
        // The hold has become its booking.
        ...(mode.kind === "paid"
          ? [db.delete(bookingHolds).where(eq(bookingHolds.id, mode.hold.id))]
          : []),
        ...notice,
        ...paidNotice,
      ])
      return {
        id: bookingId,
        businessName: business.name,
        address: business.address,
        timeZone: business.timezone,
        serviceName: service.name,
        teamMemberName,
        durationMinutes: totalMinutes,
        priceMinor: priceToPay,
        rewardDiscountMinor: reward?.discountMinor ?? null,
        currency: business.currency,
        date: input.date,
        time: input.time,
        addons: addonCheck.options.map((option) => ({
          name: option.name,
          priceMinor: option.priceMinor,
          durationMinutes: option.durationMinutes,
        })),
        payment: startedPayment,
      }
    })

    if (held) {
      return { status: "held", hold: held }
    }
    if (!confirmation) {
      await deleteProof(savedProof)
      if (rewardGone) return { status: "invalid", field: "reward" }
      return { status: "taken" }
    }
    revalidatePath("/dashboard", "layout")
    // Google Calendar hears of it now, without the booking waiting.
    requestGoogleSync(business.id)
    return {
      status: "booked",
      booking: confirmation,
      claimToken: claim?.token ?? null,
    }
  } catch {
    await deleteProof(savedProof).catch(() => {})
    console.error("Booking failed")
    return { status: "failed" }
  }
}
