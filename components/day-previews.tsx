"use client"

import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"

import {
  BookingRow,
  Box,
  firstName,
  PhotoAvatar,
  POP,
  ReplayButton,
  RISE,
  SAMPLE_PEOPLE,
  SAMPLE_SERVICES,
  SAMPLE_TEAM,
  Scene,
  TapMark,
  useSampleLocale,
} from "@/components/feature-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckIcon } from "@/components/ui/icons"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Logo } from "@/components/works-with"
import { formatClock } from "@/lib/format-booking-time"
import { useStoryLoop } from "@/hooks/use-story-loop"
import { SHOWCASE_LOOP } from "@/lib/showcase-rules"
import { cn } from "@/lib/utils"

// More of the pictures on "What you get": Lumen Studio's day, the same story
// as the rest of the page, each playing by itself (useStoryLoop). Each has its own still colour wash: the theme's
// colours, a different mix per card.
const WASHES = {
  bookings: { colors: ["--background", "--chart-1", "--chart-3"], seed: 160 },
  customers: { colors: ["--background", "--chart-2", "--verified"], seed: 200 },
  team: { colors: ["--background", "--hero-accent", "--chart-2"], seed: 240 },
  automations: {
    colors: ["--background", "--verified", "--chart-1"],
    seed: 280,
  },
  reports: {
    colors: ["--background", "--chart-3", "--hero-accent"],
    seed: 320,
  },
} as const

export type DayPreviewName = keyof typeof WASHES

export const DAY_PREVIEW_NAMES = Object.keys(WASHES) as DayPreviewName[]

// What the sample report shows: Haircut's share first, then Colour's.
const REPORT = {
  week: { total: 42, shares: [60, 40] },
  month: { total: 168, shares: [45, 55] },
} as const

// The theme's chart shades, as on the dashboard's Top services.
const SHADES = ["bg-chart-2", "bg-chart-1"]

export function DayPreview({ name }: { name: DayPreviewName }) {
  return (
    <Scene {...WASHES[name]}>
      {name === "bookings" && <BookingsPicture />}
      {name === "customers" && <CustomersPicture />}
      {name === "team" && <TeamPicture />}
      {name === "automations" && <AutomationsPicture />}
      {name === "reports" && <ReportsPicture />}
    </Scene>
  )
}

// Each team member's hours (SAMPLE_TEAM's order): their words' keys.
const TEAM_HOURS = ["weekdays", "tuesdayToSaturday", "weekends"] as const

// The day's calendar: each booking, its time and who comes; the new one
// in green.
const DAY = [
  { time: "10:00", service: 0, person: 0 },
  { time: "11:30", service: 1, person: 1 },
] as const

// The calendar filling up (useStoryLoop): the day's bookings drop in one
// by one, the new one last. Rests on the full day; tap to play it again.
function BookingsPicture() {
  const steps = useTranslations("public.home.steps.sample")
  const locale = useSampleLocale()
  const box = useRef<HTMLDivElement>(null)
  const rows = [
    ...DAY.map(({ time, service, person }) => ({
      time,
      label: `${steps(`services.${SAMPLE_SERVICES[service].key}`)} · ${firstName(SAMPLE_PEOPLE[person])}`,
      fresh: false,
    })),
    {
      time: steps("bookingTime"),
      label: `${steps("bookingService")} · ${firstName(SAMPLE_PEOPLE[2])}`,
      fresh: true,
    },
  ]
  const [shown, setShown] = useState(rows.length)
  const time = SHOWCASE_LOOP.calendar
  const replay = useStoryLoop(
    box,
    async (wait) => {
      setShown(0)
      await wait(time.start)
      for (let count = 1; count <= rows.length; count++) {
        setShown(count)
        await wait(time.rowIn)
      }
      await wait(time.shown)
    },
    () => setShown(rows.length)
  )
  return (
    <>
      <ReplayButton label={steps("replay")} onClick={replay} />
      <div ref={box} className="w-full max-w-60">
        <Box>
          <div className="flex flex-col gap-1.5 px-(--card-spacing) text-xs">
            {rows.map((row, index) => (
              <div key={row.time} className="flex h-6 items-center gap-2">
                <span className="w-16 shrink-0 whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatClock(row.time, locale)}
                </span>
                <AnimatePresence initial={false}>
                  {index < shown && (
                    <motion.span
                      {...RISE}
                      className={cn(
                        "flex h-full min-w-0 flex-1 items-center truncate rounded-md px-2 font-medium",
                        row.fresh
                          ? "bg-success text-success-foreground"
                          : "bg-primary/10 text-primary dark:bg-primary/25 dark:text-primary-foreground"
                      )}
                    >
                      {row.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </Box>
      </div>
    </>
  )
}

// Ana comes back (useStoryLoop): her visits go up by one. Rests on the
// list; tap to play it again.
function CustomersPicture() {
  const t = useTranslations("public.home.everything.sample")
  const steps = useTranslations("public.home.steps.sample")
  const box = useRef<HTMLDivElement>(null)
  const [back, setBack] = useState(false)
  const time = SHOWCASE_LOOP.customers
  const replay = useStoryLoop(
    box,
    async (wait) => {
      setBack(false)
      await wait(time.before)
      setBack(true)
      await wait(time.shown)
    },
    () => setBack(false)
  )
  const people = [
    { name: SAMPLE_PEOPLE[2], visits: back ? 12 : 11, back },
    { name: SAMPLE_PEOPLE[1], visits: 8, back: false },
  ]
  return (
    <>
      <ReplayButton label={steps("replay")} onClick={replay} />
      <div ref={box} className="w-full max-w-60">
        <Box>
          <div className="flex flex-col gap-3 px-(--card-spacing)">
            {people.map(({ name, visits, back: came }) => (
              <div
                key={name}
                className="flex items-center justify-between gap-2"
              >
                <BookingRow
                  title={name}
                  detail={`${visits} ${t("visits")}`}
                />
                <AnimatePresence>
                  {came && (
                    <motion.span {...POP} className="flex">
                      <Badge className="bg-success text-success-foreground">
                        +1
                      </Badge>
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </Box>
      </div>
    </>
  )
}

// The team, with their photos (useStoryLoop): each member in turn, with
// when they work. Tap a member to see theirs.
function TeamPicture() {
  const t = useTranslations("public.home.everything.sample")
  const box = useRef<HTMLDivElement>(null)
  const team = SAMPLE_TEAM.map(({ person, photo }, index) => ({
    name: SAMPLE_PEOPLE[person],
    photo,
    hours: t(`hours.${TEAM_HOURS[index]}`),
  }))
  const [picked, setPicked] = useState(0)
  const time = SHOWCASE_LOOP.team
  useStoryLoop(
    box,
    async (wait) => {
      for (let index = 0; index < team.length; index++) {
        setPicked(index)
        await wait(time.each)
      }
    },
    () => setPicked(0)
  )
  const member = team[picked]
  return (
    <div ref={box} className="w-full max-w-60">
      <Box>
        <div className="flex flex-col gap-3 px-(--card-spacing)">
          <div className="flex gap-2">
            {team.map(({ name, photo }, index) => (
              <Button
                key={name}
                size="icon-lg"
                variant="ghost"
                aria-label={name}
                aria-pressed={picked === index}
                onClick={() => setPicked(index)}
                className={cn(
                  "rounded-full",
                  picked === index && "ring-2 ring-primary"
                )}
              >
                <PhotoAvatar src={photo} />
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
    </div>
  )
}

type ReminderPhase = "none" | "reminder" | "tap" | "confirmed"

// A WhatsApp reminder comes in on its own (useStoryLoop) and the client
// taps Confirm. Rests on the reminder; Confirm plays it again.
function AutomationsPicture() {
  const t = useTranslations("public.home.everything.sample")
  const features = useTranslations("public.home.features.sample")
  const done = features("confirmed")
  const box = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<ReminderPhase>("reminder")
  const time = SHOWCASE_LOOP.automations
  const replay = useStoryLoop(
    box,
    async (wait) => {
      setPhase("none")
      await wait(time.reminderIn)
      setPhase("reminder")
      await wait(time.beforeTap)
      setPhase("tap")
      await wait(time.tap)
      setPhase("confirmed")
      await wait(time.confirmed)
    },
    () => setPhase("reminder")
  )
  const answered = phase === "confirmed"
  return (
    <div ref={box} className="w-full max-w-60">
      <Box>
        <div className="flex min-h-20 flex-col justify-center gap-3 px-(--card-spacing)">
          <AnimatePresence initial={false}>
            {phase !== "none" && (
              <motion.div {...RISE} className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <Logo
                    src="/brands/whatsapp-glyph-green.svg"
                    className="mt-0.5 size-4 shrink-0 object-contain"
                  />
                  <span>{t("reminder")}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={replay}
                  className={cn(
                    "relative",
                    answered &&
                      "border-transparent bg-success text-success-foreground hover:bg-success/90 hover:text-success-foreground"
                  )}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={answered ? "done" : "confirm"}
                      {...POP}
                      className="flex items-center gap-1"
                    >
                      {answered && <CheckIcon />}
                      {answered ? done : t("confirm")}
                    </motion.span>
                  </AnimatePresence>
                  {phase === "tap" && (
                    <TapMark ms={time.tap} className="left-1/2" />
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Box>
    </div>
  )
}

// What's booked most: one bar split by service, as on the dashboard. It
// shows the week, then the month (useStoryLoop); pick a period to see it.
function ReportsPicture() {
  const t = useTranslations("public.home.everything.sample")
  const steps = useTranslations("public.home.steps.sample")
  const box = useRef<HTMLDivElement>(null)
  const [period, setPeriod] = useState<keyof typeof REPORT>("week")
  const time = SHOWCASE_LOOP.reports
  useStoryLoop(
    box,
    async (wait) => {
      setPeriod("week")
      await wait(time.each)
      setPeriod("month")
      await wait(time.each)
    },
    () => setPeriod("week")
  )
  const { total, shares } = REPORT[period]
  return (
    <div ref={box} className="w-full max-w-60">
      <Box>
        <div className="flex flex-col gap-2 px-(--card-spacing)">
          <div className="flex items-center justify-between gap-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={period} {...RISE} className="flex flex-col">
                <span className="font-display text-2xl font-medium tracking-tight">
                  {total}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("bookings")}
                </span>
              </motion.div>
            </AnimatePresence>
            <ToggleGroup
              variant="outline"
              size="sm"
              value={[period]}
              onValueChange={(value) => {
                if (value[0]) setPeriod(value[0] as keyof typeof REPORT)
              }}
            >
              <ToggleGroupItem value="week">
                {t("week")}
              </ToggleGroupItem>
              <ToggleGroupItem value="month">
                {t("month")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={period} {...RISE} className="flex flex-col gap-2">
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
                {SAMPLE_SERVICES.map((service, index) => (
                  <span key={service.key} className="flex items-center gap-1">
                    <span
                      className={cn("size-2 rounded-full", SHADES[index])}
                    />
                    {steps(`services.${service.key}`)}
                  </span>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </Box>
    </div>
  )
}
