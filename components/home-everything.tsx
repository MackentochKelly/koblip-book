"use client"

import { Scene } from "@/components/feature-preview"
import { HOME_SECTION_IDS, HomeBigTitle } from "@/components/home-section-title"
import { marqueeRowClassName } from "@/components/made-for"
import {
  showcaseCardClassName,
  ShowcasePicture,
} from "@/components/showcase-row"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Marquee } from "@/components/ui/marquee"
import { Logo } from "@/components/works-with"
import type { Messages } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type Home = Messages["home"]
type Words = Home["everything"]

// The picture's still colour wash, as on "What you get".
const WASH = {
  colors: ["--background", "--hero-accent", "--chart-1"],
  seed: 360,
} as const

type App = { logo: string; logoDark?: string; name: string }

// The apps a business can connect today (the dashboard's Integrations page).
const APPS_WORKING: App[] = [
  {
    logo: "/brands/meta-symbol.png",
    logoDark: "/brands/meta-symbol-white.png",
    name: "Muse by Meta",
  },
  { logo: "/brands/google-maps.svg", name: "Google Maps" },
  { logo: "/brands/whatsapp-glyph-green.svg", name: "WhatsApp" },
  { logo: "/brands/google-calendar.png", name: "Google Calendar" },
  { logo: "/brands/koblip-chat.png", name: "Koblip Chat" },
]

// The ones marked "Coming soon" on that page.
const APPS_SOON: App[] = [
  { logo: "/brands/stripe.svg", name: "Stripe" },
  { logo: "/brands/instagram.png", name: "Instagram" },
  { logo: "/brands/facebook.png", name: "Facebook" },
  { logo: "/brands/google-business.png", name: "Google Business Profile" },
  { logo: "/brands/apple-calendar.png", name: "Apple Calendar" },
  { logo: "/brands/outlook.svg", name: "Outlook" },
  { logo: "/brands/twilio.png", name: "Twilio SMS" },
]

// The apps the business connects to, under a big title.
export function HomeEverything({ words }: { words: Home }) {
  const t = words.everything
  return (
    <section
      id={HOME_SECTION_IDS.everything}
      className="mx-auto flex w-full max-w-page flex-col gap-3 px-2 pb-12 sm:px-4"
    >
      <HomeBigTitle start={t.titleStart} end={t.titleEnd} line={t.subtitle} />
      <AppsCard words={t} soon={words.soon} />
    </section>
  )
}

// The apps: the ones working today slide one way, the ones coming the other.
function AppsCard({ words, soon }: { words: Words; soon: string }) {
  return (
    <Card className={showcaseCardClassName}>
      <ShowcasePicture className="aspect-auto h-56">
        <Scene {...WASH}>
          <ul className="sr-only">
            {APPS_WORKING.map(({ name }) => (
              <li key={name}>{name}</li>
            ))}
            {APPS_SOON.map(({ name }) => (
              <li key={name}>
                {name}: {soon}
              </li>
            ))}
          </ul>
          <div aria-hidden className="flex w-full flex-col gap-2">
            <Marquee pauseOnHover className={marqueeRowClassName}>
              {APPS_WORKING.map((app) => (
                <AppChip key={app.name} app={app} />
              ))}
            </Marquee>
            <Marquee reverse pauseOnHover className={marqueeRowClassName}>
              {APPS_SOON.map((app) => (
                <AppChip key={app.name} app={app} soon={soon} />
              ))}
            </Marquee>
          </div>
        </Scene>
      </ShowcasePicture>
      <CardHeader>
        <CardTitle>{words.items.apps.title}</CardTitle>
        <CardDescription>{words.items.apps.text}</CardDescription>
      </CardHeader>
    </Card>
  )
}

// One app in the sliding rows, a white pill on the wash.
function AppChip({ app, soon }: { app: App; soon?: string }) {
  return (
    <span className="flex h-12 items-center gap-2 rounded-full bg-card px-4 font-medium text-card-foreground ring-1 ring-foreground/5">
      <Logo
        src={app.logo}
        className={cn(
          "size-5 rounded-sm object-contain",
          app.logoDark && "dark:hidden"
        )}
      />
      {app.logoDark && (
        <Logo
          src={app.logoDark}
          className="hidden size-5 object-contain dark:block"
        />
      )}
      {app.name}
      {soon && <span className="text-xs text-muted-foreground">{soon}</span>}
    </span>
  )
}
