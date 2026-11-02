"use client"

import { useHomeLook } from "@/components/home-look"
import { HOME_SECTION_IDS } from "@/components/home-section-title"
import { ShowcaseRow } from "@/components/showcase-row"
import { StepPreview } from "@/components/step-preview"
import type { Messages } from "@/lib/i18n"

// The three steps from a Google Maps listing to bookings, each shown
// happening (the hero says them in words). The "bands" look adds a
// fourth, the bookings coming in, and the row slides.
export function HowItWorks({ words }: { words: Messages["home"] }) {
  const { steps, features } = words
  const names =
    useHomeLook() === "bands"
      ? (["find", "check", "share", "booked"] as const)
      : (["find", "check", "share"] as const)
  return (
    <ShowcaseRow
      id={HOME_SECTION_IDS.howItWorks}
      title={steps.title}
      previous={features.previous}
      next={features.next}
      items={names.map((name, index) => ({
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
