"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

import { StepReveal, type StepRevealState } from "@/components/step-reveal"
import {
  BanknoteIcon,
  ImageIcon,
  LanguagesIcon,
  PuzzleIcon,
  ShieldCheckIcon,
  TagIcon,
  UsersIcon,
  type Icon,
} from "@/components/ui/icons"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar"
import { formatPrice } from "@/lib/format-price"
import { initials } from "@/lib/initials"
import { atLeast, pause } from "@/lib/pace"
import type { PageLanguage } from "@/lib/page-language"
import { STARTER_CATALOG_RULES as RULES } from "@/lib/starter-catalog-rules"
import {
  drawTeamPhoto,
  startPolicies,
  startStarterCatalog,
} from "../api/prepare-actions"
import { starterMessagesFor } from "../i18n"
import type { StarterSummary } from "../types"

type StepId =
  | "services"
  | "extras"
  | "prices"
  | "team"
  | "photos"
  | "policies"
  | "spanish"
type StepState = StepRevealState

const STEPS: Array<{ id: StepId; icon: Icon }> = [
  { id: "services", icon: TagIcon },
  { id: "extras", icon: PuzzleIcon },
  { id: "prices", icon: BanknoteIcon },
  { id: "team", icon: UsersIcon },
  { id: "photos", icon: ImageIcon },
  { id: "policies", icon: ShieldCheckIcon },
  { id: "spanish", icon: LanguagesIcon },
]

// Up to two names, then "+3".
function shortList(names: string[], more: (count: number) => string): string {
  const shown = names.slice(0, 2).join(", ")
  return names.length > 2 ? `${shown} ${more(names.length - 2)}` : shown
}

// Between "Check your details" and "Your page is live": Meta AI writes the
// new page's services, extras, prices, team and policies, Muse Image draws the team,
// and the page is translated. Each row turns from waiting to working to
// done as the real work finishes, then the success page opens. A business
// that already has services, or an AI that is off or fails, goes straight
// on: the page works without them.
export function PreparingCard({
  businessId,
  language,
  readyHref,
  translate,
}: {
  businessId: string
  language: PageLanguage
  readyHref: string
  // The dashboard's translate action, bound to this business by the page.
  translate: () => Promise<unknown>
}) {
  const t = starterMessagesFor(language)
  const router = useRouter()
  const started = useRef(false)
  const [states, setStates] = useState<Record<StepId, StepState>>({
    services: "working",
    extras: "waiting",
    prices: "waiting",
    team: "waiting",
    photos: "waiting",
    policies: "waiting",
    spanish: "waiting",
  })
  const [summary, setSummary] = useState<StarterSummary | null>(null)
  const [policiesReady, setPoliciesReady] = useState(false)

  useEffect(() => {
    // One run per visit, also when React runs effects twice in development.
    if (started.current) return
    started.current = true
    const mark = (id: StepId, state: StepState) =>
      setStates((current) => ({ ...current, [id]: state }))

    void (async () => {
      // Muse writes the policies while the catalog is drafted, so they are
      // ready by their row and saved before the Spanish step.
      const policies = startPolicies(businessId).catch(() => ({ ok: false }))
      try {
        const result = await atLeast(
          startStarterCatalog(businessId),
          RULES.revealMs.services
        )
        if (!result.ok || !result.summary.created) {
          await policies
          return
        }
        setSummary(result.summary)
        // The real work goes on underneath while the rows are shown.
        // One photo failing (or its request) never stops the others.
        const photos = Promise.allSettled(
          result.summary.team.map(async (member) => {
            const photo = await drawTeamPhoto(businessId, member.id)
            if (!photo.ok) return
            setSummary((current) =>
              current && {
                ...current,
                team: current.team.map((person) =>
                  person.id === member.id
                    ? { ...person, photoUrl: photo.photoUrl }
                    : person
                ),
              }
            )
          })
        )
        // The Spanish version includes the policies, so it waits for them.
        const spanish = policies.then(() => translate()).catch(() => null)

        // One row at a time: each works for at least its own moment, and
        // longer when its real work isn't finished yet.
        mark("services", "done")
        for (const id of ["extras", "prices", "team"] as const) {
          mark(id, "working")
          await pause(RULES.revealMs[id])
          mark(id, "done")
        }
        mark("photos", "working")
        await atLeast(photos, RULES.revealMs.photos)
        mark("photos", "done")
        mark("policies", "working")
        const written = await atLeast(policies, RULES.revealMs.policies)
        setPoliciesReady(written.ok)
        mark("policies", "done")
        mark("spanish", "working")
        await atLeast(spanish, RULES.revealMs.spanish)
        mark("spanish", "done")
        await pause(RULES.revealDoneMs)
      } catch {
        // Nothing here blocks the owner: the success page opens anyway.
      } finally {
        router.replace(readyHref)
      }
    })()
  }, [businessId, readyHref, router, translate])

  const locale = language === "es" ? "es" : "en-US"
  const prices = (summary?.services ?? [])
    .map((service) => service.priceMinor)
    .filter((price): price is number => price !== null)
  const photosDone = summary?.team.filter((person) => person.photoUrl).length ?? 0

  const detail: Record<StepId, React.ReactNode> = {
    services: summary && shortList(summary.services.map((service) => service.name), t.more),
    extras: summary && shortList(summary.extras, t.more),
    prices:
      summary && prices.length > 0
        ? t.from(formatPrice(Math.min(...prices), summary.currency, locale))
        : null,
    team: summary && shortList(summary.team.map((person) => person.name), t.more),
    photos: summary && t.photosDone(photosDone, summary.team.length),
    policies: policiesReady && t.policiesDone,
    spanish: t.spanishDone,
  }

  return (
    <StepReveal
      media={
        <>
          {/* Meta's symbol, in each theme's own version. */}
          <Image src="/brands/meta-symbol.png" alt="" width={24} height={24} className="size-6 object-contain dark:hidden" />
          <Image src="/brands/meta-symbol-white.png" alt="" width={24} height={24} className="hidden size-6 object-contain dark:block" />
        </>
      }
      title={t.title}
      helper={t.helper}
      labels={{ working: t.working, done: t.done, waiting: t.waiting }}
      steps={STEPS.map(({ id, icon }) => ({
        id,
        icon,
        title: t.steps[id],
        state: states[id],
        detail: detail[id],
        aside: id === "photos" && summary && (
          <AvatarGroup>
            {summary.team.map((person) => (
              <Avatar key={person.id}>
                {person.photoUrl && <AvatarImage src={person.photoUrl} alt="" />}
                <AvatarFallback>{initials(person.name)}</AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
        ),
      }))}
    />
  )
}
