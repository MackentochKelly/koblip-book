"use client"

import { HOME_SECTION_IDS } from "@/components/home-section-title"
import { ShowcaseRow } from "@/components/showcase-row"
import { StepPreview } from "@/components/step-preview"
import type { Messages } from "@/lib/i18n"

// The real way in, from a Google Maps listing to bookings, each step shown
// happening: find the business, sign in with Google, the AI builds the
// page ("check"), share the link and get booked ("share").
const NAMES = ["find", "signIn", "check", "share"] as const

export function HowItWorks({ words }: { words: Messages["home"] }) {
  const { steps, features } = words
  return (
    <ShowcaseRow
      id={HOME_SECTION_IDS.howItWorks}
      title={steps.title}
      previous={features.previous}
      next={features.next}
      items={NAMES.map((name, index) => ({
        key: name,
        step: index + 1,
        title: steps[name],
        text: steps[`${name}Text`],
        picture: (
          <StepPreview
            name={name}
            words={steps.sample}
            shared={features.sample}
          />
        ),
      }))}
    />
  )
}
