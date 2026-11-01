"use client"

import { useEffect, useRef, useState } from "react"
import { preload } from "react-dom"
import Image from "next/image"
import { useRouter } from "next/navigation"

import { StepReveal, type StepRevealState } from "@/components/step-reveal"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar"
import {
  ClockIcon,
  ImageIcon,
  InfoIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon,
  StoreIcon,
  TagIcon,
  type Icon,
} from "@/components/ui/icons"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import type { PageLanguage } from "@/lib/page-language"
import { onboardingWordsFor } from "../i18n"

export type GoogleDetails = {
  name: string
  category: string | null
  address: string | null
  phone: string | null
  openDays: number
  // The first few, for the row's thumbnails.
  photoUrls: string[]
  photoCount: number
  rating: number | null
  reviewCount: number | null
  about: string | null
}

type StepId = keyof ReturnType<typeof onboardingWordsFor>["found"]["steps"]

const ICONS: Record<StepId, Icon> = {
  name: StoreIcon,
  category: TagIcon,
  address: MapPinIcon,
  phone: PhoneIcon,
  hours: ClockIcon,
  photos: ImageIcon,
  rating: StarIcon,
  about: InfoIcon,
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Right after sign-up, before "Check your details": what the page took from
// the business's Google Maps listing (saved when the business was picked),
// shown one detail at a time, then the details check opens by itself.
// Details Google doesn't have are left out.
export function GoogleDetailsCard({
  details,
  language,
  nextHref,
}: {
  details: GoogleDetails
  language: PageLanguage
  nextHref: string
}) {
  const t = onboardingWordsFor(language).found
  const router = useRouter()
  // The thumbnails come through the photo proxy, slow the first time:
  // start them now so they are there when their row appears
  // (react.dev/reference/react-dom/preload).
  for (const url of details.photoUrls) preload(url, { as: "image" })
  const started = useRef(false)

  const rows: Array<{ id: StepId; detail: React.ReactNode; aside?: React.ReactNode }> = [
    { id: "name" as const, detail: details.name },
    { id: "category" as const, detail: details.category },
    { id: "address" as const, detail: details.address },
    { id: "phone" as const, detail: details.phone },
    { id: "hours" as const, detail: details.openDays > 0 ? t.openDays(details.openDays) : null },
    {
      id: "photos" as const,
      detail: details.photoCount > 0 ? t.photoCount(details.photoCount) : null,
      aside: (
        <AvatarGroup>
          {details.photoUrls.map((url) => (
            <Avatar key={url}>
              <AvatarImage src={url} alt="" />
              <AvatarFallback>
                <ImageIcon />
              </AvatarFallback>
            </Avatar>
          ))}
        </AvatarGroup>
      ),
    },
    {
      id: "rating" as const,
      detail:
        details.rating !== null && details.reviewCount
          ? t.rating(details.rating, details.reviewCount)
          : null,
    },
    { id: "about" as const, detail: details.about ? t.aboutByMuse : null },
  ].filter((row) => row.detail)

  const [shown, setShown] = useState(0)
  const total = rows.length

  useEffect(() => {
    // One run per visit, also when React runs effects twice in development.
    if (started.current) return
    started.current = true
    void (async () => {
      for (let index = 1; index <= total; index++) {
        await pause(ONBOARDING_RULES.revealMs)
        setShown(index)
      }
      await pause(ONBOARDING_RULES.revealMs * 2)
      router.replace(nextHref)
    })()
  }, [nextHref, router, total])

  const state = (index: number): StepRevealState =>
    index < shown ? "done" : index === shown ? "working" : "waiting"

  return (
    <StepReveal
      media={
        <Image src="/brands/google-maps.svg" alt="" width={24} height={24} className="size-6 object-contain" />
      }
      title={t.title}
      helper={t.helper}
      labels={{ working: t.working, done: t.done, waiting: t.waiting }}
      steps={rows.map((row, index) => ({
        id: row.id,
        icon: ICONS[row.id],
        title: t.steps[row.id],
        state: state(index),
        detail: row.detail,
        aside: row.aside,
      }))}
    />
  )
}
