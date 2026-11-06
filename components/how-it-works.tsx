"use client"

import { useTranslations } from "next-intl"

import { HOME_SECTION_IDS } from "@/components/home-section-title"
import { ShowcaseRow } from "@/components/showcase-row"
import { StepPreview } from "@/components/step-preview"

// The real way in, from a Google Maps listing to bookings, each step shown
// happening: find the business, sign in with Google, the AI builds the
// page ("check"), share the link and get booked ("share").
const NAMES = ["find", "signIn", "check", "share"] as const

export function HowItWorks() {
  const steps = useTranslations("public.home.steps")
  const features = useTranslations("public.home.features")
  return (
    <ShowcaseRow
      id={HOME_SECTION_IDS.howItWorks}
      title={steps("title")}
      previous={features("previous")}
      next={features("next")}
      items={NAMES.map((name, index) => ({
        key: name,
        step: index + 1,
        title: steps(name),
        text: steps(`${name}Text`),
        picture: <StepPreview name={name} />,
      }))}
    />
  )
}
