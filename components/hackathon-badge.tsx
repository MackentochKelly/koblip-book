"use client"

import Image from "next/image"
import { useState } from "react"
import {
  AudioLinesIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  GlobeIcon,
  HandHeartIcon,
  ImageIcon,
  LanguagesIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SquarePenIcon,
  StoreIcon,
  ZapIcon,
} from "@/components/ui/icons"

import { glassButtonClassName } from "@/components/glass-frame"
import { ResponsivePanel } from "@/components/responsive-panel"
import { ViewTabs } from "@/components/view-tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HACKATHON, MUSE } from "@/lib/hackathon"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import { TOUCH_AREA } from "@/lib/touch-area"
import { cn } from "@/lib/utils"

type Tab = "ai" | "rules" | "whatsapp"

type Row = {
  icon: React.ReactNode
  title: string
  description: string
  // A small badge beside the title: the Meta model, or "Soon".
  tag?: string
}

// The home page's glass pill: Koblip Book was built for Meta's hackathon.
// Tap it for a panel with the Meta AI in the app, the event rules it keeps
// and what Meta approved for WhatsApp. Plain words only: Meta's logo needs
// Meta's approval (meta.com/brand/resources/meta/company-brand).
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

  const rows: Record<Tab, Row[]> = {
    ai: [
      { icon: <SparklesIcon />, ...t.ai.assistant, tag: MUSE.spark },
      { icon: <AudioLinesIcon />, ...t.ai.voice, tag: MUSE.voice },
      { icon: <StoreIcon />, ...t.ai.setup, tag: MUSE.spark },
      { icon: <ImageIcon />, ...t.ai.portraits, tag: MUSE.image },
      { icon: <SquarePenIcon />, ...t.ai.about, tag: MUSE.spark },
      { icon: <LanguagesIcon />, ...t.ai.translate, tag: MUSE.spark },
    ],
    rules: [
      {
        icon: <CalendarDaysIcon />,
        title: t.rules.newWork.title,
        description: t.rules.newWork.description(day(HACKATHON.firstCommit)),
      },
      { icon: <GlobeIcon />, ...t.rules.openSource },
      { icon: <ZapIcon />, ...t.rules.metaModels },
      { icon: <ShieldCheckIcon />, ...t.rules.control },
      { icon: <HandHeartIcon />, ...t.rules.track },
    ],
    // WhatsApp: its own file from the official pack, never recoloured, its
    // name never joined to other words
    // (meta.com/brand/resources/whatsapp/whatsapp-brand).
    whatsapp: [
      {
        icon: (
          <Image
            src="/brands/whatsapp-glyph-green.svg"
            alt=""
            width={20}
            height={20}
            unoptimized
          />
        ),
        title: provider.ownNumber,
        description: provider.ownNumberText,
        tag: home.soon,
      },
      {
        icon: (
          <Image
            src="/brands/whatsapp-glyph-green.svg"
            alt=""
            width={20}
            height={20}
            unoptimized
          />
        ),
        title: provider.reminders,
        description: provider.remindersText,
      },
      {
        icon: <ShieldCheckIcon />,
        title: provider.checked,
        description: provider.checkedText,
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
          <p className="text-sm text-muted-foreground">{t.about(dates)}</p>
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
          <div className="grid gap-3 sm:grid-cols-2">
            {rows[tab].map(({ icon, title, description, tag }) => (
              <Card key={title} size="sm">
                <CardHeader>
                  {/* The icon, and the Meta model on the same row, so the
                      words below get the card's full width. */}
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-muted [&_svg:not([class*='size-'])]:size-5">
                      {icon}
                    </div>
                    {tag && <Badge variant="secondary">{tag}</Badge>}
                  </div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </ResponsivePanel>
    </>
  )
}
