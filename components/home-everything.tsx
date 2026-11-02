"use client"

import { useState } from "react"

import { Scene } from "@/components/feature-preview"
import { HOME_SECTION_IDS, HomeBigTitle } from "@/components/home-section-title"
import { DetailsDialog } from "@/components/details-button"
import { marqueeRowClassName } from "@/components/made-for"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import {
  showcaseCardClassName,
  ShowcasePicture,
} from "@/components/showcase-row"
import {
  Card,
  CardDescription,
  CardAction,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Marquee } from "@/components/ui/marquee"
import { Logo } from "@/components/works-with"
import type { AppKey } from "@/lib/app-words"
import type { Messages } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type Home = Messages["home"]
type Words = Home["everything"]

// The picture's still colour wash, as on "What you get".
const WASH = {
  colors: ["--background", "--hero-accent", "--chart-1"],
  seed: 360,
} as const

type App = { key: AppKey; logo: string; logoDark?: string; name: string }

// The apps a business can connect today (the dashboard's Integrations page).
const APPS_WORKING: App[] = [
  {
    key: "muse",
    logo: "/brands/meta-symbol.png",
    logoDark: "/brands/meta-symbol-white.png",
    name: "Muse by Meta",
  },
  { key: "googleMaps", logo: "/brands/google-maps.svg", name: "Google Maps" },
  {
    key: "whatsapp",
    logo: "/brands/whatsapp-glyph-green.svg",
    name: "WhatsApp",
  },
  {
    key: "googleCalendar",
    logo: "/brands/google-calendar.png",
    name: "Google Calendar",
  },
  { key: "koblipChat", logo: "/brands/koblip-chat.png", name: "Koblip Chat" },
]

// The ones marked "Coming soon" on that page.
const APPS_SOON: App[] = [
  { key: "stripe", logo: "/brands/stripe.svg", name: "Stripe" },
  { key: "instagram", logo: "/brands/instagram.png", name: "Instagram" },
  { key: "facebook", logo: "/brands/facebook.png", name: "Facebook" },
  {
    key: "googleBusiness",
    logo: "/brands/google-business.png",
    name: "Google Business Profile",
  },
  {
    key: "appleCalendar",
    logo: "/brands/apple-calendar.png",
    name: "Apple Calendar",
  },
  { key: "outlook", logo: "/brands/outlook.svg", name: "Outlook" },
  { key: "sms", logo: "/brands/twilio.png", name: "Twilio SMS" },
]

// The apps the business connects to, under a big title.
export function HomeEverything({ words }: { words: Home }) {
  const t = words.everything
  return (
    <section
      id={HOME_SECTION_IDS.everything}
      className="mx-auto w-full max-w-page px-2 sm:px-4"
    >
      <HomeBigTitle start={t.titleStart} end={t.titleEnd} line={t.subtitle} />
      <AppsCard words={t} soon={words.soon} />
    </section>
  )
}

// The apps: the ones working today slide one way, the ones coming the other,
// and keep sliding under the mouse. Tap one to see what Koblip does with it.
function AppsCard({ words, soon }: { words: Words; soon: string }) {
  const [open, setOpen] = useState(false)
  const [allOpen, setAllOpen] = useState(false)
  // Kept while the panel slides away, so its words stay.
  const [shown, setShown] = useState<App>(APPS_WORKING[0])
  const show = (app: App) => {
    setShown(app)
    setOpen(true)
  }
  const details = words.appDetails[shown.key]
  return (
    <Card className={showcaseCardClassName}>
      <ShowcasePicture className="aspect-auto h-56">
        <Scene {...WASH}>
          {/* For the keyboard and screen readers: the moving rows repeat
              each app, so they get this list, one button each, shown as a
              pill while focused. */}
          <ul className="sr-only">
            {[...APPS_WORKING, ...APPS_SOON].map((app) => (
              <li key={app.key}>
                <button
                  type="button"
                  onClick={() => show(app)}
                  className={cn(
                    appChipClassName,
                    "focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  )}
                >
                  {app.name}
                  {APPS_SOON.includes(app) && `: ${soon}`}
                </button>
              </li>
            ))}
          </ul>
          <div aria-hidden className="flex w-full flex-col gap-2">
            <Marquee className={marqueeRowClassName}>
              {APPS_WORKING.map((app) => (
                <AppChip key={app.key} app={app} onClick={() => show(app)} />
              ))}
            </Marquee>
            <Marquee reverse className={marqueeRowClassName}>
              {APPS_SOON.map((app) => (
                <AppChip
                  key={app.key}
                  app={app}
                  soon={soon}
                  onClick={() => show(app)}
                />
              ))}
            </Marquee>
          </div>
        </Scene>
      </ShowcasePicture>
      <CardHeader>
        <CardTitle>{words.items.apps.title}</CardTitle>
        <CardDescription>{words.items.apps.text}</CardDescription>
        <CardAction className="self-center">
          <Button variant="outline" onClick={() => setAllOpen(true)}>
            {words.allApps.button}
          </Button>
        </CardAction>
      </CardHeader>
      <DetailsDialog
        open={open}
        onOpenChange={setOpen}
        title={details.name}
        text={details.description}
        media={<AppLogo app={shown} className="size-12" />}
      />
      {/* Every app: a large dialog on a computer, a sheet that scrolls on a
          phone. */}
      <ResponsivePanel
        open={allOpen}
        onClose={() => setAllOpen(false)}
        title={words.allApps.title}
        wide
      >
        <div className="flex flex-col gap-6">
          <AppList
            title={words.allApps.ready}
            apps={APPS_WORKING}
            details={words.appDetails}
          />
          <AppList
            title={words.allApps.soon}
            apps={APPS_SOON}
            details={words.appDetails}
          />
        </div>
      </ResponsivePanel>
    </Card>
  )
}

// A white pill on the wash.
const appChipClassName =
  "flex h-12 items-center gap-2 rounded-full bg-card px-4 font-medium text-card-foreground ring-1 ring-foreground/5"

// A pill you can tap: under the mouse it turns muted with a brand edge, and
// it presses in.
const appChipHoverClassName =
  "cursor-pointer transition-[background-color,box-shadow,scale] hover:bg-muted hover:ring-2 hover:ring-primary/40 active:scale-95"

// The app's logo, with its dark-mode version where it has one.
function AppLogo({ app, className }: { app: App; className: string }) {
  return (
    <>
      <Logo
        src={app.logo}
        className={cn(
          "rounded-sm object-contain",
          app.logoDark && "dark:hidden",
          className
        )}
      />
      {app.logoDark && (
        <Logo
          src={app.logoDark}
          className={cn("hidden object-contain dark:block", className)}
        />
      )}
    </>
  )
}

// One app in the sliding rows. Mouse and touch only: the moving rows are
// hidden from the keyboard (see the list above).
function AppChip({
  app,
  soon,
  onClick,
}: {
  app: App
  soon?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      className={cn(appChipClassName, appChipHoverClassName)}
    >
      <AppLogo app={app} className="size-5" />
      {app.name}
      {soon && <span className="text-xs text-muted-foreground">{soon}</span>}
    </button>
  )
}

// One group in the list of every app: its title, then each app with its
// logo, name and what Koblip does with it.
function AppList({
  title,
  apps,
  details,
}: {
  title: string
  apps: App[]
  details: Words["appDetails"]
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <ul className="grid gap-3 sm:grid-cols-2">
        {apps.map((app) => (
          <li key={app.key} className="flex">
            <Item variant="outline" className="w-full">
              <ItemMedia>
                <AppLogo app={app} className="size-10" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{details[app.key].name}</ItemTitle>
                {/* The whole text: this list is where it is read. */}
                <ItemDescription className="line-clamp-none">
                  {details[app.key].description}
                </ItemDescription>
              </ItemContent>
            </Item>
          </li>
        ))}
      </ul>
    </section>
  )
}
