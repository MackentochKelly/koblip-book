"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"

import {
  BookingRow,
  Box,
  firstName,
  RISE,
  Scene,
} from "@/components/feature-preview"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { CheckIcon } from "@/components/ui/icons"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Logo } from "@/components/works-with"
import { formatClock } from "@/lib/format-booking-time"
import type { Messages } from "@/lib/i18n"
import { initials } from "@/lib/initials"
import { cn } from "@/lib/utils"

type Home = Messages["home"]
type Words = Home["everything"]
type Steps = Home["steps"]["sample"]

// More of the pictures on "What you get": Lumen Studio's day, the same story
// as the rest of the page. Each has its own still colour wash: the theme's
// colours, a different mix per card.
const WASHES = {
  bookings: { colors: ["--background", "--chart-1", "--chart-3"], seed: 160 },
  customers: { colors: ["--background", "--chart-2", "--verified"], seed: 200 },
  team: { colors: ["--background", "--hero-accent", "--chart-2"], seed: 240 },
  automations: {
    colors: ["--background", "--verified", "--chart-1"],
    seed: 280,
  },
  reports: { colors: ["--background", "--chart-3", "--hero-accent"], seed: 320 },
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

export function DayPreview({
  name,
  words,
}: {
  name: DayPreviewName
  words: Home
}) {
  const t = words.everything
  const steps = words.steps.sample
  return (
    <Scene {...WASHES[name]}>
      {name === "bookings" && <BookingsPicture words={t} steps={steps} />}
      {name === "customers" && <CustomersPicture words={t} steps={steps} />}
      {name === "team" && <TeamPicture words={t} steps={steps} />}
      {name === "automations" && (
        <AutomationsPicture words={t} done={words.features.sample.confirmed} />
      )}
      {name === "reports" && <ReportsPicture words={t} steps={steps} />}
    </Scene>
  )
}

// The day's bookings, with a new one landing on top.
function BookingsPicture({ words, steps }: { words: Words; steps: Steps }) {
  const [haircut, colour] = steps.services
  const rows = [
    { person: 0, service: haircut.name, time: "10:00" },
    { person: 1, service: colour.name, time: "11:30" },
  ]
  return (
    <Box>
      <div className="flex flex-col gap-3 px-(--card-spacing)">
        <span className="font-medium">{steps.today}</span>
        <BookingRow
          icon
          title={steps.newBooking}
          detail={`${firstName(steps.people[2])} · ${steps.bookingService} · ${formatClock(steps.bookingTime, words.sample.locale)}`}
        />
        {rows.map((row) => (
          <BookingRow
            key={row.person}
            title={steps.people[row.person]}
            detail={`${row.service} · ${formatClock(row.time, words.sample.locale)}`}
          />
        ))}
      </div>
    </Box>
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
