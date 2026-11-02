"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"

import {
  BookingRow,
  Box,
  firstName,
  RISE,
  Scene,
} from "@/components/feature-preview"
import { HOME_SECTION_IDS, HomeBigTitle } from "@/components/home-section-title"
import { marqueeRowClassName } from "@/components/made-for"
import {
  showcaseCardClassName,
  ShowcasePicture,
} from "@/components/showcase-row"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { CheckIcon } from "@/components/ui/icons"
import { Marquee } from "@/components/ui/marquee"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Logo } from "@/components/works-with"
import { formatClock } from "@/lib/format-booking-time"
import type { Messages } from "@/lib/i18n"
import { initials } from "@/lib/initials"
import { cn } from "@/lib/utils"

type Home = Messages["home"]
type Words = Home["everything"]
type Steps = Home["steps"]["sample"]

// Each picture's still colour wash: the theme's colours, a different mix
// per card, as on "What you get".
const WASHES = {
  bookings: { colors: ["--background", "--chart-1", "--chart-3"], seed: 160 },
  customers: { colors: ["--background", "--chart-2", "--verified"], seed: 200 },
  team: { colors: ["--background", "--hero-accent", "--chart-2"], seed: 240 },
  automations: {
    colors: ["--background", "--verified", "--chart-1"],
    seed: 280,
  },
  reports: { colors: ["--background", "--chart-3", "--hero-accent"], seed: 320 },
  apps: { colors: ["--background", "--hero-accent", "--chart-1"], seed: 360 },
} as const

// What the sample report shows: Haircut's share first, then Colour's.
const REPORT = {
  week: { total: 42, shares: [60, 40] },
  month: { total: 168, shares: [45, 55] },
} as const

// The theme's chart shades, as on the dashboard's Top services.
const SHADES = ["bg-chart-2", "bg-chart-1"]

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

// Everything else the app does, as more of Lumen Studio's day, the same story
// as the rest of the page: pieces of the real app on colour washes. Computers
// see a mosaic, one wide card and the rest beside it; phones swipe, like the
// rows above. Under them, the apps it connects to slide past.
export function HomeEverything({ words }: { words: Home }) {
  const t = words.everything
  const steps = words.steps.sample
  // Two-finger trackpad swipes move the cards too (Embla only drags).
  const [wheel] = useState(() => WheelGesturesPlugin())
  return (
    <section
      id={HOME_SECTION_IDS.everything}
      className="mx-auto flex w-full max-w-page flex-col gap-3 px-2 pb-12 sm:px-4"
    >
      <HomeBigTitle start={t.titleStart} end={t.titleEnd} line={t.subtitle} />
      <Carousel
        // The slide turns off where the mosaic shows.
        opts={{
          align: "start",
          breakpoints: { "(min-width: 64rem)": { active: false } },
        }}
        plugins={[wheel]}
        className="flex flex-col gap-4 *:data-[slot=carousel-content]:overflow-visible"
      >
        <CarouselContent className="p-px lg:ml-0 lg:grid lg:grid-cols-6 lg:gap-3">
          <Tile wide wash={WASHES.bookings} words={t.items.bookings}>
            <BookingsPicture words={t} steps={steps} />
          </Tile>
          <Tile wash={WASHES.customers} words={t.items.customers}>
            <CustomersPicture words={t} steps={steps} />
          </Tile>
          <Tile wash={WASHES.team} words={t.items.team}>
            <TeamPicture words={t} steps={steps} />
          </Tile>
          <Tile wash={WASHES.automations} words={t.items.automations}>
            <AutomationsPicture words={t} done={words.features.sample.confirmed} />
          </Tile>
          <Tile wash={WASHES.reports} words={t.items.reports}>
            <ReportsPicture words={t} steps={steps} />
          </Tile>
        </CarouselContent>
        <div className="flex justify-center gap-2 lg:hidden">
          <CarouselPrevious
            className="static translate-none"
            aria-label={words.features.previous}
          />
          <CarouselNext
            className="static translate-none"
            aria-label={words.features.next}
          />
        </div>
      </Carousel>
      <AppsCard words={t} soon={words.soon} />
    </section>
  )
}

// One card of the mosaic: its picture on a wash, then its title and line.
function Tile({
  wide = false,
  wash,
  words,
  children,
}: {
  wide?: boolean
  wash: (typeof WASHES)[keyof typeof WASHES]
  words: { title: string; text: string }
  children: React.ReactNode
}) {
  return (
    <CarouselItem
      className={cn(
        "basis-[85%] lg:basis-auto lg:pl-0",
        wide ? "lg:col-span-4" : "lg:col-span-2"
      )}
    >
      <Card className={showcaseCardClassName}>
        <ShowcasePicture className="aspect-auto h-72">
          <Scene {...wash}>{children}</Scene>
        </ShowcasePicture>
        <CardHeader>
          <CardTitle>{words.title}</CardTitle>
          <CardDescription>{words.text}</CardDescription>
        </CardHeader>
      </Card>
    </CarouselItem>
  )
}

// The day's bookings, and a new one landing beside them, tilted like the
// hero's cards (computers only: there's no room on a phone).
function BookingsPicture({ words, steps }: { words: Words; steps: Steps }) {
  const [haircut, colour] = steps.services
  const rows = [
    { person: 0, service: haircut.name, time: "10:00" },
    { person: 1, service: colour.name, time: "11:30" },
    { person: 3, service: haircut.name, time: "17:00" },
  ]
  return (
    <div className="flex w-full items-center justify-center gap-6">
      <Box className="max-w-72">
        <div className="flex flex-col gap-3 px-(--card-spacing)">
          <span className="font-medium">{steps.today}</span>
          {rows.map((row) => (
            <BookingRow
              key={row.person}
              title={steps.people[row.person]}
              detail={`${row.service} · ${formatClock(row.time, words.sample.locale)}`}
            />
          ))}
        </div>
      </Box>
      <Box className="hidden max-w-60 rotate-2 md:block">
        <div className="px-(--card-spacing)">
          <BookingRow
            icon
            title={steps.newBooking}
            detail={`${firstName(steps.people[2])} · ${steps.bookingService} · ${formatClock(steps.bookingTime, words.sample.locale)}`}
          />
        </div>
      </Box>
    </div>
  )
}

function CustomersPicture({ words, steps }: { words: Words; steps: Steps }) {
  const people = [
    { name: steps.people[2], visits: 12 },
    { name: steps.people[1], visits: 8 },
    { name: steps.people[4], visits: 3 },
  ]
  return (
    <Box>
      <div className="flex flex-col gap-3 px-(--card-spacing)">
        {people.map(({ name, visits }) => (
          <BookingRow
            key={name}
            title={name}
            detail={`${visits} ${words.sample.visits}`}
          />
        ))}
      </div>
    </Box>
  )
}

// The team: tap a member to see when they work.
function TeamPicture({ words, steps }: { words: Words; steps: Steps }) {
  const team = [
    { name: steps.people[4], hours: words.sample.hours[0] },
    { name: steps.people[0], hours: words.sample.hours[1] },
    { name: steps.people[3], hours: words.sample.hours[2] },
  ]
  const [picked, setPicked] = useState(team[0].name)
  const member = team.find(({ name }) => name === picked) ?? team[0]
  return (
    <Box>
      <div className="flex flex-col gap-3 px-(--card-spacing)">
        <div className="flex gap-2">
          {team.map(({ name }) => (
            <Button
              key={name}
              size="icon-lg"
              variant="ghost"
              aria-label={name}
              aria-pressed={picked === name}
              onClick={() => setPicked(name)}
              className={cn(
                "rounded-full",
                picked === name && "ring-2 ring-primary"
              )}
            >
              <Avatar>
                <AvatarFallback>{initials(name)}</AvatarFallback>
              </Avatar>
            </Button>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={member.name} {...RISE} className="flex flex-col">
            <span className="truncate font-medium">{member.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {member.hours}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </Box>
  )
}

// A WhatsApp reminder with its reply button: tap it and the client's answer
// comes in. Tap the answer to start over.
function AutomationsPicture({ words, done }: { words: Words; done: string }) {
  const [answered, setAnswered] = useState(false)
  return (
    <div className="flex w-full max-w-60 flex-col gap-2">
      <Box>
        <div className="flex flex-col gap-3 px-(--card-spacing)">
          <div className="flex items-start gap-2">
            <Logo
              src="/brands/whatsapp-glyph-green.svg"
              className="mt-0.5 size-4 shrink-0 object-contain"
            />
            <span>{words.sample.reminder}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            aria-pressed={answered}
            onClick={() => setAnswered(!answered)}
          >
            {words.sample.confirm}
          </Button>
        </div>
      </Box>
      <AnimatePresence>
        {answered && (
          <motion.div {...RISE} role="status">
            <Bubble align="end">
              <BubbleContent className="flex items-center gap-1.5">
                <CheckIcon className="size-4 shrink-0" />
                {done}
              </BubbleContent>
            </Bubble>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// What's booked most: one bar split by service, as on the dashboard. Pick a
// period and it changes.
function ReportsPicture({ words, steps }: { words: Words; steps: Steps }) {
  const [period, setPeriod] = useState<keyof typeof REPORT>("week")
  const { total, shares } = REPORT[period]
  return (
    <Box>
      <div className="flex flex-col gap-3 px-(--card-spacing)">
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[period]}
          onValueChange={(value) => {
            if (value[0]) setPeriod(value[0] as keyof typeof REPORT)
          }}
        >
          <ToggleGroupItem value="week">{words.sample.week}</ToggleGroupItem>
          <ToggleGroupItem value="month">{words.sample.month}</ToggleGroupItem>
        </ToggleGroup>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={period} {...RISE} className="flex flex-col gap-2">
            <span className="font-display text-3xl font-medium tracking-tight">
              {total}
              <span className="ml-1 text-xs font-normal tracking-normal text-muted-foreground">
                {words.sample.bookings}
              </span>
            </span>
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
              {shares.map((share, index) => (
                <div
                  key={index}
                  className={SHADES[index]}
                  style={{ width: `${share}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              {steps.services.map((service, index) => (
                <span key={service.name} className="flex items-center gap-1">
                  <span className={cn("size-2 rounded-full", SHADES[index])} />
                  {service.name}
                </span>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </Box>
  )
}

// The apps: the ones working today slide one way, the ones coming the other.
function AppsCard({ words, soon }: { words: Words; soon: string }) {
  return (
    <Card className={showcaseCardClassName}>
      <ShowcasePicture className="aspect-auto h-56">
        <Scene {...WASHES.apps}>
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
