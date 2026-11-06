"use client"

import { useTranslations } from "next-intl"

import { DAY_PREVIEW_NAMES, DayPreview } from "@/components/day-previews"
import { FeaturePreview } from "@/components/feature-preview"
import { useHomeLook } from "@/components/home-look"
import { HOME_SECTION_IDS } from "@/components/home-section-title"
import {
  ShowcaseGrid,
  ShowcaseRow,
  type ShowcaseItem,
} from "@/components/showcase-row"

// What an owner gets. Each picture is a small preview of the app.
export function HomeFeatures() {
  const t = useTranslations("public.home.features")
  const everything = useTranslations("public.home.everything.items")
  const main: ShowcaseItem[] = [
    {
      key: "page",
      title: t("page"),
      text: t("pageText"),
      picture: <FeaturePreview name="page" />,
    },
    {
      key: "book",
      title: t("book"),
      text: t("bookText"),
      picture: <FeaturePreview name="book" />,
    },
    {
      key: "assistant",
      title: t("assistant"),
      text: t("assistantText"),
      picture: <FeaturePreview name="assistant" />,
    },
  ]
  const day: ShowcaseItem[] = DAY_PREVIEW_NAMES.map((name) => ({
    key: name,
    title: everything(`${name}.title`),
    text: everything(`${name}.text`),
    picture: <DayPreview name={name} />,
  }))
  // The "bands" look: a language card too, and all of them in a still grid.
  if (useHomeLook() === "bands") {
    return (
      <ShowcaseGrid
        id={HOME_SECTION_IDS.features}
        title={t("title")}
        subtitle={t("subtitle")}
        items={[
          ...main,
          {
            key: "language",
            title: t("language"),
            text: t("languageText"),
            picture: <FeaturePreview name="language" />,
          },
          ...day,
        ]}
      />
    )
  }
  return (
    <ShowcaseRow
      id={HOME_SECTION_IDS.features}
      title={t("title")}
      previous={t("previous")}
      next={t("next")}
      items={[...main, ...day]}
    />
  )
}
