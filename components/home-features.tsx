"use client"

import { FeaturePreview } from "@/components/feature-preview"
import { useHomeLook } from "@/components/home-look"
import { HOME_SECTION_IDS } from "@/components/home-section-title"
import { ShowcaseRow } from "@/components/showcase-row"
import type { Messages } from "@/lib/i18n"

// What an owner gets: only features that work today (WhatsApp reminders
// are "Soon" in WorksWith, so not here). Each picture is a small preview of
// the app.
export function HomeFeatures({
  words,
}: {
  words: Messages["home"]["features"]
}) {
  const look = useHomeLook()
  return (
    <ShowcaseRow
      id={HOME_SECTION_IDS.features}
      title={words.title}
      previous={words.previous}
      next={words.next}
      items={[
        {
          key: "page",
          title: words.page,
          text: words.pageText,
          picture: <FeaturePreview name="page" sample={words.sample} />,
        },
        {
          key: "book",
          title: words.book,
          text: words.bookText,
          picture: <FeaturePreview name="book" sample={words.sample} />,
        },
        {
          key: "assistant",
          title: words.assistant,
          text: words.assistantText,
          picture: <FeaturePreview name="assistant" sample={words.sample} />,
        },
        // The "bands" look adds a fourth, and the row slides.
        ...(look === "bands"
          ? [
              {
                key: "language",
                title: words.language,
                text: words.languageText,
                picture: (
                  <FeaturePreview name="language" sample={words.sample} />
                ),
              },
            ]
          : []),
      ]}
    />
  )
}
