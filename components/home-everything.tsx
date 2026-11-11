"use client"

import { useTranslations } from "next-intl"
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
import { cn } from "@/lib/utils"

// The picture's still colour wash, as on "What you get".
const WASH = {
  colors: ["--background", "--hero-accent", "--chart-1"],
  seed: 360,
} as const

// The apps' keys in the shared words (lib/i18n/en/app.ts).
type AppKey =
  | "muse"
  | "googleMaps"
  | "whatsapp"
  | "googleCalendar"
  | "koblipChat"
  | "stripe"
  | "instagram"
  | "facebook"
  | "googleBusiness"
  | "appleCalendar"
  | "outlook"
  | "sms"

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
  { key: "stripe", logo: "/brands/stripe.svg", name: "Stripe" },
]

// The ones marked "Coming soon" on that page.
const APPS_SOON: App[] = [
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
export function HomeEverything() {
  const t = useTranslations("public.home.everything")
  return (
    <section
      id={HOME_SECTION_IDS.everything}
      className="mx-auto w-full max-w-page px-2 sm:px-4"
    >
      <HomeBigTitle
        start={t("titleStart")}
        end={t("titleEnd")}
        line={t("subtitle")}
      />
      <AppsCard />
    </section>
  )
}

// The apps: the ones working today slide one way, the ones coming the other
// (marked "Coming soon" only in the list of every app),
// and keep sliding under the mouse. Tap one to see what Koblip does with it.
function AppsCard() {
  const t = useTranslations("public.home")
  const apps = useTranslations("app")
  const soon = t("soon")
  const [open, setOpen] = useState(false)
  const [allOpen, setAllOpen] = useState(false)
  // Kept while the panel slides away, so its words stay.
  const [shown, setShown] = useState<App>(APPS_WORKING[0])
  const show = (app: App) => {
    setShown(app)
    setOpen(true)
  }
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
                <AppChip key={app.key} app={app} onClick={() => show(app)} />
              ))}
            </Marquee>
          </div>
        </Scene>
      </ShowcasePicture>
      <CardHeader>
        <CardTitle>{t("everything.items.apps.title")}</CardTitle>
        <CardDescription>{t("everything.items.apps.text")}</CardDescription>
        <CardAction className="self-center">
          <Button variant="outline" onClick={() => setAllOpen(true)}>
            {t("everything.allApps.button")}
          </Button>
        </CardAction>
      </CardHeader>
      <DetailsDialog
        open={open}
        onOpenChange={setOpen}
        title={apps(`${shown.key}.name`)}
        text={apps(`${shown.key}.description`)}
        media={<AppLogo app={shown} className="size-12" />}
      />
      {/* Every app: a large dialog on a computer, a sheet that scrolls on a
          phone. */}
      <ResponsivePanel
        open={allOpen}
        onClose={() => setAllOpen(false)}
        title={t("everything.allApps.title")}
        wide
      >
        <div className="flex flex-col gap-6">
          <AppList title={t("everything.allApps.ready")} apps={APPS_WORKING} />
          <AppList title={t("everything.allApps.soon")} apps={APPS_SOON} />
        </div>
      </ResponsivePanel>
    </Card>
  )
}

// A white pill on the wash.
const appChipClassName =
  "flex h-12 items-center gap-2 rounded-full bg-card px-4 font-medium text-card-foreground ring-1 ring-foreground/5"

// A pill you can tap: under the mouse it turns muted, and it presses in.
const appChipHoverClassName =
  "cursor-pointer transition-[background-color,scale] hover:bg-muted active:scale-95"

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
function AppChip({ app, onClick }: { app: App; onClick: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      className={cn(appChipClassName, appChipHoverClassName)}
    >
      <AppLogo app={app} className="size-5" />
      {app.name}
    </button>
  )
}

// One group in the list of every app: its title, then each app with its
// logo, name and what Koblip does with it.
function AppList({ title, apps }: { title: string; apps: App[] }) {
  const t = useTranslations("app")
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
                <ItemTitle>{t(`${app.key}.name`)}</ItemTitle>
                {/* The whole text: this list is where it is read. */}
                <ItemDescription className="line-clamp-none">
                  {t(`${app.key}.description`)}
                </ItemDescription>
              </ItemContent>
            </Item>
          </li>
        ))}
      </ul>
    </section>
  )
}
