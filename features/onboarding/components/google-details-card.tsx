"use client"

import { useEffect, useRef, useState } from "react"
import { preload } from "react-dom"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

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
import { pause } from "@/lib/pace"
import type en from "../i18n/en"

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

type StepId = keyof typeof en.found.steps

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

// Right after sign-up, before "Check your details": what the page took from
// the business's Google Maps listing (saved when the business was picked),
// shown one detail at a time, then the details check opens by itself.
// Details Google doesn't have are left out.
export function GoogleDetailsCard({
  details,
  nextHref,
}: {
  details: GoogleDetails
  nextHref: string
}) {
  const t = useTranslations("onboarding.found")
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
    { id: "hours" as const, detail: details.openDays > 0 ? t("openDays", { days: details.openDays }) : null },
    {
      id: "photos" as const,
      detail: details.photoCount > 0 ? t("photoCount", { count: details.photoCount }) : null,
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
          ? t("rating", {
              rating: details.rating.toFixed(1),
              reviews: details.reviewCount,
            })
          : null,
    },
    { id: "about" as const, detail: details.about ? t("aboutByMuse") : null },
  ].filter((row) => row.detail)

  const [shown, setShown] = useState(0)
  // The shown rows' ids, joined so the effect sees a stable value.
  const order = rows.map((row) => row.id).join(",")

  useEffect(() => {
    // One run per visit, also when React runs effects twice in development.
    if (started.current) return
    started.current = true
    const ids = order.split(",") as StepId[]
    void (async () => {
      // One detail at a time, each working for its own moment.
      for (const [index, id] of ids.entries()) {
        await pause(ONBOARDING_RULES.revealMs[id])
        setShown(index + 1)
      }
      await pause(ONBOARDING_RULES.revealDoneMs)
      router.replace(nextHref)
    })()
  }, [nextHref, order, router])

  const state = (index: number): StepRevealState =>
    index < shown ? "done" : index === shown ? "working" : "waiting"

  return (
    <StepReveal
      media={
        <Image src="/brands/google-maps.svg" alt="" width={24} height={24} className="size-6 object-contain" />
      }
      title={t("title")}
      helper={t("helper")}
      labels={{ working: t("working"), done: t("done"), waiting: t("waiting") }}
      steps={rows.map((row, index) => ({
        id: row.id,
        icon: ICONS[row.id],
        title: t(`steps.${row.id}`),
        state: state(index),
        detail: row.detail,
        aside: row.aside,
      }))}
    />
  )
}
