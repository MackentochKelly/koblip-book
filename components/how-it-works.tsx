"use client"

import { ShowcaseRow } from "@/components/showcase-row"
import { StepPreview } from "@/components/step-preview"
import type { Messages } from "@/lib/i18n"

// The three steps from a Google Maps listing to bookings, each shown
// happening (the hero says them in words).
export function HowItWorks({ words }: { words: Messages["home"] }) {
  const { steps, features } = words
  return (
    <ShowcaseRow
      title={steps.title}
      previous={features.previous}
      next={features.next}
      items={(["find", "check", "share"] as const).map((name, index) => ({
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
