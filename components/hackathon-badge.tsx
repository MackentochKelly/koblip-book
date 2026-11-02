"use client"

import Image from "next/image"
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
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
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

// The home page's glass pill: Koblip Book was built for Meta's hackathon.
// Tap it for a panel with the Meta AI in the app (one card per model), the
// event rules it keeps (a checklist) and what Meta approved for WhatsApp.
// Short rows only, so it reads at a glance. Plain words only: Meta's logo
// needs Meta's approval (meta.com/brand/resources/meta/company-brand).
export function HackathonBadge({ language }: { language: PageLanguage }) {
  const messages = messagesFor(language)
  const home = messages.home
  const t = messages.hackathon
  const provider = home.provider
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("ai")
  const day = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(messages.locale, {
      month: "short",
      day: "numeric",
    })
  const dates = new Intl.DateTimeFormat(messages.locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatRange(
    new Date(`${HACKATHON.start}T12:00:00`),
    new Date(`${HACKATHON.end}T12:00:00`)
  )
  const d = t.details
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
          { icon: <SparklesIcon />, ...t.ai.assistant, more: d.assistant },
          { icon: <StoreIcon />, ...t.ai.setup, more: d.setup },
          { icon: <SquarePenIcon />, ...t.ai.about, more: d.about },
          { icon: <LanguagesIcon />, ...t.ai.translate, more: d.translate },
        ],
      },
      {
        heading: MUSE.voice,
        rows: [{ icon: <AudioLinesIcon />, ...t.ai.voice, more: d.voice }],
      },
      {
        heading: MUSE.image,
        rows: [{ icon: <ImageIcon />, ...t.ai.portraits, more: d.portraits }],
      },
    ],
    rules: [
      {
        rows: [
          {
            icon: check,
            title: t.rules.newWork(firstDay),
            more: { ...d.newWork, how: d.newWork.how(firstDay) },
          },
          { icon: check, title: t.rules.openSource, more: d.openSource },
          { icon: check, title: t.rules.metaModels, more: d.metaModels },
          { icon: check, title: t.rules.control, more: d.control },
          { icon: check, title: t.rules.track, more: d.track },
        ],
      },
    ],
    whatsapp: [
      {
        rows: [
          {
            icon: whatsapp,
            title: provider.ownNumber,
            description: provider.ownNumberText,
            tag: home.soon,
            more: d.ownNumber,
          },
          {
            icon: whatsapp,
            title: provider.reminders,
            description: provider.remindersText,
            more: d.reminders,
          },
          {
            icon: <ShieldCheckIcon />,
            title: provider.checked,
            description: provider.checkedText,
            more: d.checked,
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
        {t.badge}
        <ChevronRightIcon data-icon="inline-end" />
      </Badge>
      <ResponsivePanel
        open={open}
        onClose={() => setOpen(false)}
        title={HACKATHON.name}
        description={t.about(dates, Object.keys(MUSE).length)}
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
              {t.event}
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
            <Button
              nativeButton={false}
              render={
                <a href={HACKATHON.repoUrl} target="_blank" rel="noreferrer" />
              }
            >
              {t.code}
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 pt-3">
          <ViewTabs
            views={[
              { id: "ai", label: t.tabs.ai },
              { id: "rules", label: t.tabs.rules },
              { id: "whatsapp", label: t.tabs.whatsapp },
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
                                label={`${t.more}: ${title}`}
                                className="size-6"
                              >
                                <MoreAbout
                                  title={title}
                                  more={more}
                                  sections={t.sections}
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
