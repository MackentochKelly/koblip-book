"use client"

import { DAY_PREVIEW_NAMES, DayPreview } from "@/components/day-previews"
import { FeaturePreview } from "@/components/feature-preview"
import { useHomeLook } from "@/components/home-look"
import { HOME_SECTION_IDS } from "@/components/home-section-title"
import {
  ShowcaseGrid,
  ShowcaseRow,
  type ShowcaseItem,
} from "@/components/showcase-row"
import type { Messages } from "@/lib/i18n"

// The pictures here hold whole lists, so they need the height on any width.
const PICTURE_CLASS_NAME = "aspect-auto h-72"

// What an owner gets. Each picture is a small preview of the app.
export function HomeFeatures({ words }: { words: Messages["home"] }) {
  const t = words.features
  const main: ShowcaseItem[] = [
    {
      key: "page",
      title: t.page,
      text: t.pageText,
      picture: <FeaturePreview name="page" sample={t.sample} />,
    },
    {
      key: "book",
      title: t.book,
      text: t.bookText,
      picture: <FeaturePreview name="book" sample={t.sample} />,
    },
    {
      key: "assistant",
      title: t.assistant,
      text: t.assistantText,
      picture: <FeaturePreview name="assistant" sample={t.sample} />,
    },
  ]
  const day: ShowcaseItem[] = DAY_PREVIEW_NAMES.map((name) => ({
    key: name,
    title: words.everything.items[name].title,
    text: words.everything.items[name].text,
    picture: <DayPreview name={name} words={words} />,
  }))
  // The "bands" look: a language card too, and all of them in a still grid.
  if (useHomeLook() === "bands") {
    return (
      <ShowcaseGrid
        id={HOME_SECTION_IDS.features}
        title={t.title}
        subtitle={t.subtitle}
        pictureClassName={PICTURE_CLASS_NAME}
        items={[
          ...main,
          {
            key: "language",
            title: t.language,
            text: t.languageText,
            picture: <FeaturePreview name="language" sample={t.sample} />,
          },
          ...day,
        ]}
      />
    )
  }
  return (
    <ShowcaseRow
      id={HOME_SECTION_IDS.features}
      title={t.title}
      previous={t.previous}
      next={t.next}
      pictureClassName={PICTURE_CLASS_NAME}
      items={[...main, ...day]}
    />
  )
}
