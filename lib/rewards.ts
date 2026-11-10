import "server-only"
import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
} from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"

import { EARNING_STATUSES } from "./booking-rules"
import { db } from "./db"
import { saveAll } from "./db/save-all"
import {
  bookings,
  rewardEvents,
  rewardRuleServices,
  rewardRules,
  rewards,
  services,
} from "./db/schema"
import { hasFeature } from "./plan-access"
import {
  earnAmount,
  goalsReached,
  redeemable,
  REWARD_RULES,
  rewardCopy,
  rewardExpiry,
  type HeldReward,
  type RewardActor,
  type RewardRule,
  type RewardServices,
  type RewardType,
} from "./reward-rules"
import { bookingTurnKey, runInTurn } from "./run-in-turn"

// Rewards in the database (docs/plans/rewards.md): reading a business's
// rules, counting what a booking earns, and making, holding and giving
// back earned rewards. The rules themselves are in ./reward-rules.

type EventRow = typeof rewardEvents.$inferSelect
type RewardRow = typeof rewards.$inferSelect

// A business's rules in the owner's order, each with its services. Ended
// rules are left out unless asked for (their history still needs them).
export async function rewardRulesFor(
  businessId: string,
  options: { withEnded?: boolean } = {}
): Promise<RewardRule[]> {
  const [ruleRows, serviceRows] = await Promise.all([
    db
      .select()
      .from(rewardRules)
      .where(eq(rewardRules.businessId, businessId))
      .orderBy(asc(rewardRules.position), asc(rewardRules.createdAt)),
    db
      .select({
        ruleId: rewardRuleServices.ruleId,
        role: rewardRuleServices.role,
        id: services.id,
        name: services.name,
      })
      .from(rewardRuleServices)
      .innerJoin(services, eq(services.id, rewardRuleServices.serviceId))
      .where(eq(rewardRuleServices.businessId, businessId))
      .orderBy(asc(services.position)),
  ])
  const servicesOf = (
    ruleId: string,
    role: "earn" | "reward"
  ): RewardServices => {
    const list = serviceRows
      .filter((row) => row.ruleId === ruleId && row.role === role)
      .map(({ id, name }) => ({ id, name }))
    return list.length > 0 ? list : null
  }
  return ruleRows
    .filter((row) => options.withEnded || row.status !== "ended")
    .map((row) => ({
      id: row.id,
      status: row.status,
      earnType: row.earnType,
      earnServices: servicesOf(row.id, "earn"),
      earnMinPriceMinor: row.earnMinPriceMinor,
      goal: row.goal,
      rewardType: row.rewardType,
      rewardValue: row.rewardValue,
      rewardCount: row.rewardCount,
      rewardServices: servicesOf(row.id, "reward"),
      maxDiscountMinor: row.maxDiscountMinor,
      expiresDays: row.expiresDays,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      maxPerCustomer: row.maxPerCustomer,
      paidOnly: row.paidOnly,
    }))
}

const sum = (events: readonly Pick<EventRow, "amount">[]) =>
  events.reduce((total, event) => total + event.amount, 0)

// How many times the goal was reached and stands: each convert that took
// the goal, less each one given back.
function timesEarned(events: readonly Pick<EventRow, "type" | "amount">[]) {
  return events
    .filter((event) => event.type === "convert")
    .reduce((count, event) => count + (event.amount < 0 ? 1 : -1), 0)
}

type NewEvent = typeof rewardEvents.$inferInsert & { id: string }

// Brings one customer's rule in line with its history: gives the goal
// back for rewards that were earned on visits since undone (only while
// every booking the reward covers is still unused), then makes a reward
// for each goal reached. Returns the writes and how many rewards it made.
function settle(
  businessId: string,
  customerKey: string,
  rule: RewardRule,
  events: readonly (EventRow | NewEvent)[],
  held: readonly RewardRow[],
  earning: boolean,
  now: string
): { writes: BatchItem<"sqlite">[]; made: number } {
  const writes: BatchItem<"sqlite">[] = []
  let balance = sum(events)
  let earned = timesEarned(events)
  if (balance < 0) {
    const converts = events
      .filter((event) => event.type === "convert" && event.amount < 0)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    for (const convert of converts) {
      if (balance >= 0) break
      const made = held.filter((reward) => reward.eventId === convert.id)
      if (
        made.length === 0 ||
        made.some((reward) => reward.status !== "available")
      ) {
        continue
      }
      writes.push(
        db
          .update(rewards)
          .set({ status: "removed" })
          .where(
            inArray(
              rewards.id,
              made.map((reward) => reward.id)
            )
          ),
        db.insert(rewardEvents).values({
          businessId,
          ruleId: rule.id,
          customerKey,
          type: "convert",
          amount: -convert.amount,
          createdAt: now,
        })
      )
      balance -= convert.amount
      earned -= 1
    }
  }
  const reached = earning ? goalsReached(rule, balance, earned) : 0
  for (let index = 0; index < reached; index += 1) {
    const eventId = crypto.randomUUID()
    writes.push(
      db.insert(rewardEvents).values({
        id: eventId,
        businessId,
        ruleId: rule.id,
        customerKey,
        type: "convert",
        amount: -rule.goal,
        createdAt: now,
      }),
      db.insert(rewards).values(
        Array.from({ length: rule.rewardCount }, () => ({
          businessId,
          ruleId: rule.id,
          customerKey,
          reward: rewardCopy(rule),
          eventId,
          earnedAt: now,
          expiresAt: rewardExpiry(rule.expiresDays, now),
        }))
      )
    )
  }
  return { writes, made: reached * rule.rewardCount }
}

async function customerState(businessId: string, customerKey: string) {
  const [events, held] = await Promise.all([
    db
      .select()
      .from(rewardEvents)
      .where(
        and(
          eq(rewardEvents.businessId, businessId),
          eq(rewardEvents.customerKey, customerKey)
        )
      ),
    db
      .select()
      .from(rewards)
      .where(
        and(
          eq(rewards.businessId, businessId),
          eq(rewards.customerKey, customerKey)
        )
      )
      .orderBy(desc(rewards.earnedAt)),
  ])
  return { events, held }
}

// What recounting a booking made: rewards newly earned, for the bell.
export interface RecountResult {
  businessId: string
  customerKey: string | null
  earned: number
}

async function recount(
  bookingId: string,
  now: Date
): Promise<RecountResult | null> {
  const nowIso = now.toISOString()
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!booking) return null
  const writes: BatchItem<"sqlite">[] = []
  const ended = booking.endAt <= nowIso
  const happening = EARNING_STATUSES.some((status) => status === booking.status)
  let priceMinor = booking.priceMinor
  let usedReward: RewardType | null = null

  // The reward the booking itself holds: given back when the booking is
  // cancelled or a no-show, used for good once the visit happened.
  if (booking.rewardId) {
    const [own] = await db
      .select()
      .from(rewards)
      .where(eq(rewards.id, booking.rewardId))
      .limit(1)
    if (!happening) {
      priceMinor =
        (booking.priceMinor ?? 0) + (booking.rewardDiscountMinor ?? 0)
      writes.push(
        db
          .update(rewards)
          .set({ status: "available" })
          .where(
            and(
              eq(rewards.id, booking.rewardId),
              inArray(rewards.status, ["held", "used"])
            )
          ),
        db
          .update(bookings)
          .set({ rewardId: null, rewardDiscountMinor: null, priceMinor })
          .where(eq(bookings.id, booking.id))
      )
    } else {
      usedReward = own?.reward.type ?? null
      if (own && own.status !== (ended ? "used" : "held")) {
        writes.push(
          db
            .update(rewards)
            .set({ status: ended ? "used" : "held" })
            .where(eq(rewards.id, own.id))
        )
      }
    }
  }

  let earned = 0
  if (booking.customerKey) {
    const [featureOn, rules, state] = await Promise.all([
      hasFeature(booking.businessId, "rewards"),
      rewardRulesFor(booking.businessId, { withEnded: true }),
      customerState(booking.businessId, booking.customerKey),
    ])
    for (const rule of rules) {
      const events: (EventRow | NewEvent)[] = state.events.filter(
        (event) => event.ruleId === rule.id
      )
      // What this booking counts for on the rule so far.
      const counted = sum(
        events.filter(
          (event) =>
            event.bookingId === booking.id &&
            (event.type === "earn" || event.type === "reverse")
        )
      )
      const earning = featureOn && rule.status === "active"
      const counts = earnAmount(
        rule,
        {
          status: booking.status,
          startAt: booking.startAt,
          endAt: booking.endAt,
          serviceId: booking.serviceId,
          priceMinor,
          paymentStatus: booking.paymentStatus,
          usedReward,
        },
        nowIso
      )
      // A booking already counted is always put right, also on a rule that
      // is off; one not counted yet earns only on a rule that is on.
      const change = counted !== 0 ? counts - counted : earning ? counts : 0
      if (change !== 0) {
        const event: NewEvent = {
          id: crypto.randomUUID(),
          businessId: booking.businessId,
          ruleId: rule.id,
          customerKey: booking.customerKey,
          type: change > 0 ? "earn" : "reverse",
          amount: change,
          bookingId: booking.id,
          createdAt: nowIso,
        }
        writes.push(db.insert(rewardEvents).values(event))
        events.push(event)
      }
      const settled = settle(
        booking.businessId,
        booking.customerKey,
        rule,
        events,
        state.held.filter((reward) => reward.ruleId === rule.id),
        earning,
        nowIso
      )
      writes.push(...settled.writes)
      earned += settled.made
    }
  }

  // An ended booking is done with until something about it changes; one
  // still ahead (moved forward again) waits for the timer.
  const countedAt = ended ? nowIso : null
  if (booking.rewardsCountedAt !== countedAt) {
    writes.push(
      db
        .update(bookings)
        .set({ rewardsCountedAt: countedAt })
        .where(eq(bookings.id, booking.id))
    )
  }
  await saveAll(writes)
  return {
    businessId: booking.businessId,
    customerKey: booking.customerKey,
    earned,
  }
}

// Looks at one booking again after anything about it changed (it ended,
// was completed, cancelled, a no-show, marked paid or moved) and writes
// what that means for rewards. Safe to call any number of times: it only
// writes the difference. Takes the business's booking turn, so it never
// runs beside a booking being made; never call it from inside that turn.
export async function recountBooking(
  bookingId: string,
  now: Date = new Date()
): Promise<RecountResult | null> {
  const [found] = await db
    .select({ businessId: bookings.businessId })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!found) return null
  return runInTurn(bookingTurnKey(found.businessId), () =>
    recount(bookingId, now)
  )
}

// After a booking's status or payment changed and was saved: rewards
// follow. The change itself already stands, so a failure here is logged,
// never shown as the change having failed.
export async function rewardsAfterChange(bookingId: string): Promise<void> {
  try {
    await recountBooking(bookingId)
  } catch (error) {
    console.error("Couldn't recount rewards", error)
  }
}

// One customer's place on a rule.
export interface RuleProgress {
  rule: RewardRule
  // The sum of the history: may be under 0 or over the goal.
  balance: number
}

export interface CustomerReward extends HeldReward {
  ruleId: string
  status: RewardRow["status"]
  earnedAt: string
}

// Everything one customer has at a business: where they are on each rule
// that is on (or that they have something on), and their rewards, newest
// first.
export async function customerRewards(
  businessId: string,
  customerKey: string
): Promise<{ progress: RuleProgress[]; rewards: CustomerReward[] }> {
  const [rules, state] = await Promise.all([
    rewardRulesFor(businessId, { withEnded: true }),
    customerState(businessId, customerKey),
  ])
  const progress = rules
    .map((rule) => ({
      rule,
      balance: sum(state.events.filter((event) => event.ruleId === rule.id)),
    }))
    .filter((item) => item.rule.status === "active" || item.balance !== 0)
  return {
    progress,
    rewards: state.held.map((row) => ({
      id: row.id,
      ruleId: row.ruleId,
      reward: row.reward,
      status: row.status,
      earnedAt: row.earnedAt,
      expiresAt: row.expiresAt,
    })),
  }
}

// The rewards a customer can redeem today, soonest to expire first.
export async function availableRewards(
  businessId: string,
  customerKey: string,
  now: Date = new Date()
): Promise<HeldReward[]> {
  const nowIso = now.toISOString()
  const rows = await db
    .select()
    .from(rewards)
    .where(
      and(
        eq(rewards.businessId, businessId),
        eq(rewards.customerKey, customerKey),
        eq(rewards.status, "available")
      )
    )
    .orderBy(asc(rewards.expiresAt))
  return rows
    .filter((row) => row.expiresAt === null || row.expiresAt > nowIso)
    .map((row) => ({
      id: row.id,
      reward: row.reward,
      expiresAt: row.expiresAt,
    }))
}

// A reward about to be redeemed on a booking: it must be this business's,
// this customer's, still available today, and usable on the service.
// Returns what it takes off the service's price; null when it cannot be
// used. Call it again inside the booking turn, right before saving.
export async function rewardToRedeem(input: {
  businessId: string
  rewardId: string
  customerKey: string
  service: { id: string; priceMinor: number | null }
  now?: Date
}): Promise<{ id: string; discountMinor: number } | null> {
  if (!(await hasFeature(input.businessId, "rewards"))) return null
  const [row] = await db
    .select()
    .from(rewards)
    .where(
      and(
        eq(rewards.id, input.rewardId),
        eq(rewards.businessId, input.businessId),
        eq(rewards.customerKey, input.customerKey),
        eq(rewards.status, "available")
      )
    )
    .limit(1)
  if (!row) return null
  const discountMinor = redeemable(
    { id: row.id, reward: row.reward, expiresAt: row.expiresAt },
    input.service,
    (input.now ?? new Date()).toISOString()
  )
  return discountMinor === null ? null : { id: row.id, discountMinor }
}

// The write that puts a reward on a booking being saved: add it to the
// same saveAll as the booking, inside the business's booking turn, after
// checking the reward with redeemable(). The booking's unique rewardId
// index is the last guard: a reward can never be on two bookings.
export function holdRewardWrite(rewardId: string): BatchItem<"sqlite"> {
  return db
    .update(rewards)
    .set({ status: "held" })
    .where(and(eq(rewards.id, rewardId), eq(rewards.status, "available")))
}

// A change to a customer's progress by hand (the owner, or the assistant
// for the owner), with who and why, then rewards made or taken back as
// the new total says.
export async function adjustProgress(input: {
  businessId: string
  ruleId: string
  customerKey: string
  amount: number
  actor: Exclude<RewardActor, "system">
  actorUserId: string
  note: string | null
  now?: Date
}): Promise<{ ok: true; earned: number } | { ok: false }> {
  return runInTurn(bookingTurnKey(input.businessId), async () => {
    const nowIso = (input.now ?? new Date()).toISOString()
    const [rules, state, featureOn] = await Promise.all([
      rewardRulesFor(input.businessId, { withEnded: true }),
      customerState(input.businessId, input.customerKey),
      hasFeature(input.businessId, "rewards"),
    ])
    const rule = rules.find((item) => item.id === input.ruleId)
    if (!rule || input.amount === 0) return { ok: false as const }
    const event: NewEvent = {
      id: crypto.randomUUID(),
      businessId: input.businessId,
      ruleId: rule.id,
      customerKey: input.customerKey,
      type: "adjust",
      amount: input.amount,
      actor: input.actor,
      actorUserId: input.actorUserId,
      note: input.note,
      createdAt: nowIso,
    }
    const settled = settle(
      input.businessId,
      input.customerKey,
      rule,
      [...state.events.filter((item) => item.ruleId === rule.id), event],
      state.held.filter((reward) => reward.ruleId === rule.id),
      featureOn && rule.status === "active",
      nowIso
    )
    await saveAll([db.insert(rewardEvents).values(event), ...settled.writes])
    return { ok: true as const, earned: settled.made }
  })
}

// The timer's work: rewards past their date expire, and bookings that
// ended since the last look are counted (nothing else happens when a
// booking's time simply passes). Only bookings of a business with a rule
// old enough to count them are looked at.
export async function sweepRewards(now: Date = new Date()): Promise<number> {
  const nowIso = now.toISOString()
  await db
    .update(rewards)
    .set({ status: "expired" })
    .where(
      and(
        eq(rewards.status, "available"),
        isNotNull(rewards.expiresAt),
        lte(rewards.expiresAt, nowIso)
      )
    )
  const due = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        isNull(bookings.rewardsCountedAt),
        lte(bookings.endAt, nowIso),
        inArray(bookings.status, [...EARNING_STATUSES]),
        isNotNull(bookings.customerKey),
        exists(
          db
            .select({ one: sql`1` })
            .from(rewardRules)
            .where(
              and(
                eq(rewardRules.businessId, bookings.businessId),
                lte(rewardRules.startsAt, bookings.startAt)
              )
            )
        )
      )
    )
    .orderBy(asc(bookings.endAt))
    .limit(REWARD_RULES.sweepBatch)
  for (const booking of due) {
    await recountBooking(booking.id, now)
  }
  return due.length
}
