"use server"

import { and, asc, eq, ne } from "drizzle-orm"

import { BOOKING_RULES } from "@/lib/booking-rules"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  rewardEvents,
  rewardRuleServices,
  rewardRules,
  services,
} from "@/lib/db/schema"
import { hasFeature } from "@/lib/plan-access"
import { revalidateBusiness } from "@/lib/revalidate-business"
import {
  checkRewardRule,
  REWARD_RULES,
  type RewardRuleForm,
  type RewardRuleInput,
} from "@/lib/reward-rules"
import type { ActionResult } from "../types"
import { ownedBusiness } from "./owned-business"
import { bookingRangeUtc } from "./queries"

// The owner's Rewards page (docs/plans/rewards.md): making, changing,
// turning on and off and removing reward rules. Every action is the
// owner's, on their own business only, and only on a plan with rewards.

async function ownedWithRewards(businessId: string) {
  const owned = await ownedBusiness(businessId)
  if (!owned) return null
  return (await hasFeature(owned.business.id, "rewards")) ? owned : null
}

function serviceRows(
  businessId: string,
  ruleId: string,
  values: RewardRuleInput
) {
  return [
    ...(values.earnServiceIds ?? []).map((serviceId) => ({
      businessId,
      ruleId,
      serviceId,
      role: "earn" as const,
    })),
    ...(values.rewardServiceIds ?? []).map((serviceId) => ({
      businessId,
      ruleId,
      serviceId,
      role: "reward" as const,
    })),
  ]
}

// The moment a rule stops counting: the end of its last day in the
// business's time zone. null = no end; undefined = not a real day, or one
// already over.
function endOfLastDay(
  endsOn: unknown,
  timeZone: string
): string | null | undefined {
  if (endsOn === null || endsOn === undefined) return null
  if (typeof endsOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
    return undefined
  }
  const [year, month, day] = endsOn.split("-").map(Number)
  const real = new Date(Date.UTC(year, month - 1, day))
  if (real.getUTCMonth() !== month - 1 || real.getUTCDate() !== day) {
    return undefined
  }
  const { end } = bookingRangeUtc(endsOn, endsOn, timeZone)
  return end > new Date().toISOString() ? end : undefined
}

// Adds a rule (ruleId null) or saves one. A new rule counts bookings from
// this moment on: visits from before it never count. Changing a rule
// changes what is earned from now on; rewards already earned keep what
// they were. The error names the field that is wrong.
export async function saveRewardRule(
  businessId: string,
  ruleId: string | null,
  input: RewardRuleForm
): Promise<ActionResult<{ id: string }>> {
  const owned = await ownedWithRewards(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  const endsAt = endOfLastDay(input?.endsOn, owned.business.timezone)
  if (endsAt === undefined) return { ok: false, error: "endsAt" }
  const [serviceIds, existing] = await Promise.all([
    db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.businessId, owned.business.id)),
    db
      .select({ id: rewardRules.id })
      .from(rewardRules)
      .where(
        and(
          eq(rewardRules.businessId, owned.business.id),
          ne(rewardRules.status, "ended")
        )
      )
      .orderBy(asc(rewardRules.position)),
  ])
  const checked = checkRewardRule(
    { ...input, endsAt },
    new Set(serviceIds.map((service) => service.id)),
    BOOKING_RULES.maxPriceMinor
  )
  if (!checked.ok) return checked
  const { earnServiceIds, rewardServiceIds, ...fields } = checked.values
  void earnServiceIds
  void rewardServiceIds
  if (ruleId === null) {
    if (existing.length >= REWARD_RULES.maxRules) {
      return { ok: false, error: "full" }
    }
    const id = crypto.randomUUID()
    const rows = serviceRows(owned.business.id, id, checked.values)
    await saveAll([
      db.insert(rewardRules).values({
        id,
        businessId: owned.business.id,
        ...fields,
        startsAt: new Date().toISOString(),
        position: existing.length,
      }),
      ...(rows.length > 0 ? [db.insert(rewardRuleServices).values(rows)] : []),
    ])
    revalidateBusiness(owned.business.slug)
    return { ok: true, id }
  }
  if (!existing.some((rule) => rule.id === ruleId)) {
    return { ok: false, error: "not_found" }
  }
  const rows = serviceRows(owned.business.id, ruleId, checked.values)
  await saveAll([
    db.update(rewardRules).set(fields).where(eq(rewardRules.id, ruleId)),
    db.delete(rewardRuleServices).where(eq(rewardRuleServices.ruleId, ruleId)),
    ...(rows.length > 0 ? [db.insert(rewardRuleServices).values(rows)] : []),
  ])
  revalidateBusiness(owned.business.slug)
  return { ok: true, id: ruleId }
}

// Turns a rule on or off. Off stops earning; rewards already earned stay
// usable until they expire.
export async function setRewardRuleOn(
  businessId: string,
  ruleId: string,
  on: boolean
): Promise<ActionResult> {
  const owned = await ownedWithRewards(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  if (typeof on !== "boolean") return { ok: false, error: "invalid" }
  const changed = await db
    .update(rewardRules)
    .set({ status: on ? "active" : "off" })
    .where(
      and(
        eq(rewardRules.id, ruleId),
        eq(rewardRules.businessId, owned.business.id),
        ne(rewardRules.status, "ended")
      )
    )
    .returning({ id: rewardRules.id })
  if (changed.length === 0) return { ok: false, error: "not_found" }
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

// Removes a rule. One somebody already earned on is ended, not deleted:
// its history and the rewards earned on it stay. One nobody earned on is
// deleted.
export async function removeRewardRule(
  businessId: string,
  ruleId: string
): Promise<ActionResult> {
  const owned = await ownedWithRewards(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  const mine = and(
    eq(rewardRules.id, ruleId),
    eq(rewardRules.businessId, owned.business.id)
  )
  const [rule] = await db
    .select({ id: rewardRules.id })
    .from(rewardRules)
    .where(mine)
    .limit(1)
  if (!rule) return { ok: false, error: "not_found" }
  const [used] = await db
    .select({ id: rewardEvents.id })
    .from(rewardEvents)
    .where(eq(rewardEvents.ruleId, rule.id))
    .limit(1)
  if (used) {
    await db.update(rewardRules).set({ status: "ended" }).where(mine)
  } else {
    await db.delete(rewardRules).where(mine)
  }
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}
