"use client"

import Image from "next/image"
import { useState } from "react"
import {
  AudioLinesIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  ExternalLinkIcon,
  ImageIcon,
  LanguagesIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SquarePenIcon,
  StoreIcon,
} from "@/components/ui/icons"

import { glassButtonClassName } from "@/components/glass-frame"
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
}

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
  const check = <CircleCheckIcon className="text-success" />
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
          { icon: <SparklesIcon />, ...t.ai.assistant },
          { icon: <StoreIcon />, ...t.ai.setup },
          { icon: <SquarePenIcon />, ...t.ai.about },
          { icon: <LanguagesIcon />, ...t.ai.translate },
        ],
      },
      {
        heading: MUSE.voice,
        rows: [{ icon: <AudioLinesIcon />, ...t.ai.voice }],
      },
      {
        heading: MUSE.image,
        rows: [{ icon: <ImageIcon />, ...t.ai.portraits }],
      },
    ],
    rules: [
      {
        rows: [
          { icon: check, title: t.rules.newWork(day(HACKATHON.firstCommit)) },
          { icon: check, title: t.rules.openSource },
          { icon: check, title: t.rules.metaModels },
          { icon: check, title: t.rules.control },
          { icon: check, title: t.rules.track },
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
          },
          {
            icon: whatsapp,
            title: provider.reminders,
            description: provider.remindersText,
          },
          {
            icon: <ShieldCheckIcon />,
            title: provider.checked,
            description: provider.checkedText,
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
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t.about(dates, Object.keys(MUSE).length)}
          </p>
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
                    {rows.map(({ icon, title, description, tag }) => (
                      <Item key={title} size="xs">
                        <ItemMedia variant="icon">{icon}</ItemMedia>
                        <ItemContent>
                          <ItemTitle>
                            {title}
                            {tag && <Badge variant="secondary">{tag}</Badge>}
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
