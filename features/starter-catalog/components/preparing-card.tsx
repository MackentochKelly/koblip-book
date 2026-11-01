"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import {
  BanknoteIcon,
  CircleCheckIcon,
  ImageIcon,
  LanguagesIcon,
  PuzzleIcon,
  TagIcon,
  UsersIcon,
  type Icon,
} from "@/components/ui/icons"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { formatPrice } from "@/lib/format-price"
import { initials } from "@/lib/initials"
import type { PageLanguage } from "@/lib/page-language"
import { STARTER_CATALOG_RULES as RULES } from "@/lib/starter-catalog-rules"
import { cn } from "@/lib/utils"
import { drawTeamPhoto, startStarterCatalog } from "../api/prepare-actions"
import { starterMessagesFor } from "../i18n"
import type { StarterSummary } from "../types"

type StepId = "services" | "extras" | "prices" | "team" | "photos" | "spanish"
type StepState = "waiting" | "working" | "done"

const STEPS: Array<{ id: StepId; icon: Icon }> = [
  { id: "services", icon: TagIcon },
  { id: "extras", icon: PuzzleIcon },
  { id: "prices", icon: BanknoteIcon },
  { id: "team", icon: UsersIcon },
  { id: "photos", icon: ImageIcon },
  { id: "spanish", icon: LanguagesIcon },
]

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Up to two names, then "+3".
function shortList(names: string[], more: (count: number) => string): string {
  const shown = names.slice(0, 2).join(", ")
  return names.length > 2 ? `${shown} ${more(names.length - 2)}` : shown
}

// Between "Check your details" and "Your page is live": Meta AI writes the
// new page's services, extras, prices and team, Muse Image draws the team,
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
  const reduceMotion = useReducedMotion()
  const started = useRef(false)
  const [states, setStates] = useState<Record<StepId, StepState>>({
    services: "working",
    extras: "waiting",
    prices: "waiting",
    team: "waiting",
    photos: "waiting",
    spanish: "waiting",
  })
  const [summary, setSummary] = useState<StarterSummary | null>(null)

  useEffect(() => {
    // One run per visit, also when React runs effects twice in development.
    if (started.current) return
    started.current = true
    const mark = (id: StepId, state: StepState) =>
      setStates((current) => ({ ...current, [id]: state }))

    void (async () => {
      try {
        const result = await startStarterCatalog(businessId)
        if (!result.ok || !result.summary.created) return
        setSummary(result.summary)
        // The catalog arrived in one answer; show it a row at a time.
        for (const id of ["services", "extras", "prices", "team"] as const) {
          mark(id, "done")
          await pause(RULES.revealMs)
        }
        mark("photos", "working")
        // One photo failing (or its request) never stops the others.
        await Promise.allSettled(
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
        mark("photos", "done")
        mark("spanish", "working")
        await translate()
        mark("spanish", "done")
        await pause(RULES.revealMs)
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
    spanish: t.spanishDone,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          {/* Meta's symbol, in each theme's own version. */}
          <Image src="/brands/meta-symbol.png" alt="" width={24} height={24} className="size-6 object-contain dark:hidden" />
          <Image src="/brands/meta-symbol-white.png" alt="" width={24} height={24} className="hidden size-6 object-contain dark:block" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{t.title}</h1>
          <p className="text-muted-foreground">{t.helper}</p>
        </div>
      </div>

      <ItemGroup role="list" aria-live="polite">
        {STEPS.map(({ id, icon: StepIcon }) => {
          const state = states[id]
          return (
            <Item
              key={id}
              role="listitem"
              size="sm"
              className={cn(
                "transition-opacity duration-300",
                state === "waiting" && "opacity-50"
              )}
            >
              <ItemMedia variant="icon">
                <StepIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{t.steps[id]}</ItemTitle>
                <AnimatePresence initial={false}>
                  {state === "done" && detail[id] && (
                    <motion.div
                      initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ItemDescription>{detail[id]}</ItemDescription>
                    </motion.div>
                  )}
                </AnimatePresence>
              </ItemContent>
              {id === "photos" && summary && state !== "waiting" && (
                <AvatarGroup>
                  {summary.team.map((person) => (
                    <Avatar key={person.id}>
                      {person.photoUrl && <AvatarImage src={person.photoUrl} alt="" />}
                      <AvatarFallback>{initials(person.name)}</AvatarFallback>
                    </Avatar>
                  ))}
                </AvatarGroup>
              )}
              <span className="flex size-6 items-center justify-center text-muted-foreground">
                {state === "working" && <Spinner aria-label={t.working} />}
                {state === "done" && (
                  <CircleCheckIcon className="size-5 text-primary" aria-label={t.done} />
                )}
                {state === "waiting" && <span className="sr-only">{t.waiting}</span>}
              </span>
            </Item>
          )
        })}
      </ItemGroup>
    </div>
  )
}
