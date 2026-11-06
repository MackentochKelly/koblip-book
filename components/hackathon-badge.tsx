"use client"

import Image from "next/image"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import {
  AudioLinesIcon,
  ChevronRightIcon,
  CircleCheckFilledIcon,
  ExternalLinkIcon,
  ImageIcon,
  LanguagesIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SquarePenIcon,
  StoreIcon,
} from "@/components/ui/icons"

import { glassButtonClassName } from "@/components/glass-frame"
import { InfoTip } from "@/components/info-tip"
import { ResponsivePanel } from "@/components/responsive-panel"
import { ViewTabs } from "@/components/view-tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover"
import { HACKATHON, MUSE } from "@/lib/hackathon"
import { TOUCH_AREA } from "@/lib/touch-area"
import { cn } from "@/lib/utils"

type Tab = "ai" | "rules" | "whatsapp"

type Row = {
  icon: React.ReactNode
  title: string
  description?: string
  // A small badge beside the title, like "Soon".
  tag?: string
  // The ⓘ beside the title: the same thing in full, in short sections.
  more?: More
}

type More = { what: string; how: string; note?: string }

// One card: the Meta model that does these (named once, on top), or none.
type Group = { heading?: string; rows: Row[] }

// The ⓘ texts with a "Good to know", and those without one.
type WithNote =
  | "assistant"
  | "setup"
  | "about"
  | "translate"
  | "voice"
  | "portraits"
  | "metaModels"
  | "reminders"
type WithoutNote = "openSource" | "control" | "track" | "ownNumber" | "checked"

type AiFeature =
  | "assistant"
  | "setup"
  | "about"
  | "translate"
  | "voice"
  | "portraits"

// The home page's glass pill: Koblip Book was built for Meta's hackathon.
// Tap it for a panel with the Meta AI in the app (one card per model), the
// event rules it keeps (a checklist) and what Meta approved for WhatsApp.
// Short rows only, so it reads at a glance. Plain words only: Meta's logo
// needs Meta's approval (meta.com/brand/resources/meta/company-brand).
export function HackathonBadge() {
  const t = useTranslations("public.hackathon")
  const home = useTranslations("public.home")
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("ai")
  const day = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
    })
  const dates = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatRange(
    new Date(`${HACKATHON.start}T12:00:00`),
    new Date(`${HACKATHON.end}T12:00:00`)
  )
  const ai = (key: AiFeature) => ({
    title: t(`ai.${key}.title`),
    description: t(`ai.${key}.description`),
  })
  const more = (key: WithNote): More => ({
    what: t(`details.${key}.what`),
    how: t(`details.${key}.how`),
    note: t(`details.${key}.note`),
  })
  const brief = (key: WithoutNote): More => ({
    what: t(`details.${key}.what`),
    how: t(`details.${key}.how`),
  })
  const firstDay = day(HACKATHON.firstCommit)
  const check = <CircleCheckFilledIcon className="size-5 text-success" />
  // WhatsApp: its own file from the official pack, never recoloured, its
  // name never joined to other words
  // (meta.com/brand/resources/whatsapp/whatsapp-brand).
  const whatsapp = (
    <Image
      src="/brands/whatsapp-glyph-green.svg"
      alt=""
      width={16}
      height={16}
      unoptimized
    />
  )

  const groups: Record<Tab, Group[]> = {
    ai: [
      {
        heading: MUSE.spark,
        rows: [
          {
            icon: <SparklesIcon />,
            ...ai("assistant"),
            more: more("assistant"),
          },
          { icon: <StoreIcon />, ...ai("setup"), more: more("setup") },
          { icon: <SquarePenIcon />, ...ai("about"), more: more("about") },
          {
            icon: <LanguagesIcon />,
            ...ai("translate"),
            more: more("translate"),
          },
        ],
      },
      {
        heading: MUSE.voice,
        rows: [
          { icon: <AudioLinesIcon />, ...ai("voice"), more: more("voice") },
        ],
      },
      {
        heading: MUSE.image,
        rows: [
          { icon: <ImageIcon />, ...ai("portraits"), more: more("portraits") },
        ],
      },
    ],
    rules: [
      {
        rows: [
          {
            icon: check,
            title: t("rules.newWork", { date: firstDay }),
            more: {
              what: t("details.newWork.what"),
              how: t("details.newWork.how", { date: firstDay }),
            },
          },
          {
            icon: check,
            title: t("rules.openSource"),
            more: brief("openSource"),
          },
          {
            icon: check,
            title: t("rules.metaModels"),
            more: more("metaModels"),
          },
          { icon: check, title: t("rules.control"), more: brief("control") },
          { icon: check, title: t("rules.track"), more: brief("track") },
        ],
      },
    ],
    whatsapp: [
      {
        rows: [
          {
            icon: whatsapp,
            title: home("provider.ownNumber"),
            description: home("provider.ownNumberText"),
            tag: home("soon"),
            more: brief("ownNumber"),
          },
          {
            icon: whatsapp,
            title: home("provider.reminders"),
            description: home("provider.remindersText"),
            more: more("reminders"),
          },
          {
            icon: <ShieldCheckIcon />,
            title: home("provider.checked"),
            description: home("provider.checkedText"),
            more: brief("checked"),
          },
        ],
      },
    ],
  }

  return (
    <>
      <Badge
        variant="outline"
        className={cn(
          glassButtonClassName,
          TOUCH_AREA,
          "h-auto cursor-pointer self-center overflow-visible px-3 py-1 text-sm"
        )}
        render={<button type="button" onClick={() => setOpen(true)} />}
      >
        <SparklesIcon data-icon="inline-start" />
        {t("badge")}
        <ChevronRightIcon data-icon="inline-end" />
      </Badge>
      <ResponsivePanel
        open={open}
        onClose={() => setOpen(false)}
        title={HACKATHON.name}
        description={t("about", { dates, models: Object.keys(MUSE).length })}
        wide
        footer={
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a href={HACKATHON.eventUrl} target="_blank" rel="noreferrer" />
              }
            >
              {t("event")}
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
            <Button
              nativeButton={false}
              render={
                <a href={HACKATHON.repoUrl} target="_blank" rel="noreferrer" />
              }
            >
              {t("code")}
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 pt-3">
          <ViewTabs
            views={[
              { id: "ai", label: t("tabs.ai") },
              { id: "rules", label: t("tabs.rules") },
              { id: "whatsapp", label: t("tabs.whatsapp") },
            ]}
            value={tab}
            onChange={setTab}
            ariaLabel={HACKATHON.name}
          />
          {/* A card with one row sits beside the next on a computer. */}
          <div className="grid gap-3 sm:grid-cols-2">
            {groups[tab].map(({ heading, rows }) => (
              <Card
                key={heading ?? tab}
                size="sm"
                className={cn("gap-1", rows.length > 1 && "sm:col-span-2")}
              >
                {heading && (
                  <CardHeader>
                    <CardTitle>{heading}</CardTitle>
                  </CardHeader>
                )}
                {/* The rows' own padding lines them up with the heading; two
                    per row on a computer. */}
                <CardContent className="px-1">
                  <ItemGroup
                    className={cn(rows.length > 1 && "sm:grid sm:grid-cols-2")}
                  >
                    {rows.map(({ icon, title, description, tag, more }) => (
                      <Item key={title} size="xs">
                        <ItemMedia variant="icon">{icon}</ItemMedia>
                        <ItemContent>
                          <ItemTitle>
                            {title}
                            {tag && <Badge variant="secondary">{tag}</Badge>}
                            {more && (
                              <InfoTip
                                label={`${t("more")}: ${title}`}
                                className="size-6"
                              >
                                <MoreAbout
                                  title={title}
                                  more={more}
                                  sections={{
                                    what: t("sections.what"),
                                    how: t("sections.how"),
                                    note: t("sections.note"),
                                  }}
                                />
                              </InfoTip>
                            )}
                          </ItemTitle>
                          {description && (
                            <ItemDescription>{description}</ItemDescription>
                          )}
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </ResponsivePanel>
    </>
  )
}

// The ⓘ's words: the title, then each part under its own short label.
function MoreAbout({
  title,
  more,
  sections,
}: {
  title: string
  more: More
  sections: Record<keyof More, string>
}) {
  const parts = (["what", "how", "note"] as const).filter((key) => more[key])
  return (
    <>
      <PopoverHeader>
        <PopoverTitle>{title}</PopoverTitle>
      </PopoverHeader>
      {parts.map((key) => (
        <PopoverHeader key={key}>
          <p className="font-medium">{sections[key]}</p>
          <PopoverDescription>{more[key]}</PopoverDescription>
        </PopoverHeader>
      ))}
    </>
  )
}
