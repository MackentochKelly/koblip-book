import "server-only"

import type { businesses } from "@/lib/db/schema"
import { isMetaAiEnabled } from "@/lib/meta-ai"
import { STARTER_CATALOG_RULES as RULES } from "@/lib/starter-catalog-rules"
import type { StarterResult } from "../types"
import {
  catalogSummary,
  draftFor,
  drawMemberPhoto,
  hasCatalog,
  writeCatalog,
} from "./fill-catalog"
import {
  draftPoliciesFor,
  policyParts,
  writeMissingPolicies,
} from "./fill-policies"

type Business = typeof businesses.$inferSelect

// Muse's setup work for a new business, started on the server as soon as
// the owner signs up (the Google details screen) and joined later by
// "Getting your page ready". Next.js runs a page's Server Actions one at a
// time (docs: guides/server-actions, Sequential dispatch), so work started
// from the browser would wait in line; here it runs side by side.
//
// One job per business and kind in this server process: a second caller
// gets the same promise. A finished job is kept a while so the setup
// screen still sees what it made; a failed one is dropped so it can retry.
// Kept on globalThis: the page that starts a job and the Server Action
// that joins it can load this file as separate module copies (and the dev
// server reloads it on every edit), but they share the process.
const store = globalThis as typeof globalThis & {
  koblipPrepareJobs?: Map<string, Promise<unknown>>
}

function once<T extends { ok: boolean }>(
  key: string,
  work: () => Promise<T>
): Promise<T> {
  const jobs = (store.koblipPrepareJobs ??= new Map())
  const running = jobs.get(key) as Promise<T> | undefined
  if (running) return running
  const job = work()
  jobs.set(key, job)
  const forget = () => {
    if (jobs.get(key) === job) jobs.delete(key)
  }
  job.then(
    (result) => {
      if (!result.ok) return forget()
      setTimeout(forget, RULES.jobKeepMs).unref?.()
    },
    forget
  )
  return job
}

// Meta AI writes the services, extras, prices and team from the Google
// details. A business that already has services or team is never changed.
export function catalogJob(business: Business): Promise<StarterResult> {
  if (business.setupFinishedAt !== null || business.isDemo) {
    return catalogSummary(business, null, false).then((summary) => ({ ok: true, summary }))
  }
  return once(`catalog:${business.id}`, async (): Promise<StarterResult> => {
    if (await hasCatalog(business.id)) {
      return { ok: true, summary: await catalogSummary(business, null, true) }
    }
    if (!isMetaAiEnabled()) {
      return { ok: false, error: "ai_off" }
    }
    const catalog = await draftFor(business)
    if (!catalog) {
      return { ok: false, error: "failed" }
    }
    // The owner may have added something while Meta AI was writing.
    if (await hasCatalog(business.id)) {
      return { ok: true, summary: await catalogSummary(business, null, true) }
    }
    await writeCatalog(business, catalog)
    return {
      ok: true,
      summary: await catalogSummary(business, catalog.team.role, true),
    }
  })
}

// Muse writes the booking policy, terms, privacy notice and their key
// points. Parts the business already has are never changed. Ok when it has
// them all now.
export function policiesJob(business: Business): Promise<{ ok: boolean }> {
  return once(`policies:${business.id}`, async () => {
    const before = await policyParts(business.id)
    if (before.texts && before.points) {
      return { ok: true }
    }
    const policies = await draftPoliciesFor(business)
    if (!policies) {
      return { ok: false }
    }
    // The owner may have saved some while Muse was writing.
    await writeMissingPolicies(business, policies, await policyParts(business.id))
    return { ok: true }
  })
}

// Muse Image draws one team member's photo, for a member with none yet.
export function photoJob(
  business: Business,
  memberId: string
): Promise<{ ok: true; photoUrl: string } | { ok: false }> {
  return once(`photo:${business.id}:${memberId}`, async () => {
    if (!business.ownerId) return { ok: false as const }
    const photoUrl = await drawMemberPhoto(business, memberId, business.ownerId)
    return photoUrl ? { ok: true as const, photoUrl } : { ok: false as const }
  })
}

// Starts everything, for a business the caller has checked is the owner's:
// the catalog and policies side by side, the team photos as soon as the
// team is written, then `translate` (the Spanish version, which includes
// them all). Resolves when the work is done; nothing here throws.
export async function startPreparing(
  business: Business,
  translate: () => Promise<unknown>
): Promise<void> {
  if (business.isDemo || business.setupFinishedAt !== null) return
  const catalog = catalogJob(business).then((result) => {
    if (result.ok && result.summary.created) {
      for (const member of result.summary.team) {
        if (!member.photoUrl) {
          void photoJob(business, member.id).catch(() => null)
        }
      }
    }
  })
  await Promise.allSettled([catalog, policiesJob(business)])
  await Promise.resolve().then(translate).catch(() => null)
}
