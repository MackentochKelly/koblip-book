"use client"

import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { Box, POP, RISE, Scene } from "@/components/feature-preview"
import { Rating } from "@/components/rating"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckIcon, MapPinIcon, SearchIcon } from "@/components/ui/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { formatClock } from "@/lib/format-booking-time"
import { formatPrice } from "@/lib/format-price"
import { useStoryLoop } from "@/hooks/use-story-loop"
import type { Messages } from "@/lib/i18n"
import { SHOWCASE_LOOP } from "@/lib/showcase-rules"

type Words = Messages["home"]["steps"]["sample"]
type Shared = Messages["home"]["features"]["sample"]

// The pictures on the "How it works" cards, made like FeaturePreview's:
// a small piece of the real app on a still colour wash, tap to play.
const STEPS = {
  find: { colors: ["--background", "--chart-2", "--hero-accent"], seed: 20 },
  check: { colors: ["--background", "--chart-1", "--verified"], seed: 60 },
  share: { colors: ["--background", "--hero-accent", "--chart-3"], seed: 100 },
} as const

export type StepPreviewName = keyof typeof STEPS

export function StepPreview({
  name,
  words,
  shared,
}: {
  name: StepPreviewName
  words: Words
  shared: Shared
}) {
  return (
    <Scene {...STEPS[name]}>
      {name === "find" && <FindPreview words={words} shared={shared} />}
      {name === "check" && <CheckPreview words={words} shared={shared} />}
      {name === "share" && <SharePreview words={words} />}
    </Scene>
  )
}

type FindPhase = "typing" | "result" | "tap" | "page"

// Plays by itself (useStoryLoop): the name types in, the Google Maps
// result shows, a tap lands on it and the business page appears. Rests on
// the search with its result; Search plays it again.
function FindPreview({ words, shared }: { words: Words; shared: Shared }) {
  const name = shared.business
  const box = useRef<HTMLDivElement>(null)
  const [typed, setTyped] = useState(name.length)
  const [phase, setPhase] = useState<FindPhase>("result")
  const time = SHOWCASE_LOOP.find
  const replay = useStoryLoop(
    box,
    async (wait) => {
      setPhase("typing")
      for (let count = 0; count <= name.length; count++) {
        setTyped(count)
        await wait(time.type)
      }
      await wait(time.beforeResult)
      setPhase("result")
      await wait(time.beforeTap)
      setPhase("tap")
      await wait(time.tap)
      setPhase("page")
      await wait(time.page)
    },
    () => {
      setTyped(name.length)
      setPhase("result")
    }
  )

  return (
    <div ref={box} className="w-full max-w-60">
      <Box>
        <div className="flex min-h-24 flex-col justify-center gap-3 px-(--card-spacing)">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "page" ? (
              <motion.div
                key="page"
                {...POP}
                className="flex items-center gap-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/25 dark:text-primary-foreground">
                  <MapPinIcon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{name}</span>
                  <Rating
                    rating={4.9}
                    reviewCount={128}
                    locale={shared.locale}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div key="search" {...POP} className="flex flex-col gap-3">
                <InputGroup>
                  <InputGroupInput
                    readOnly
                    tabIndex={-1}
                    aria-hidden
                    value={name.slice(0, typed)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={words.search}
                      onClick={replay}
                    >
                      <SearchIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <div className="min-h-9">
                  <AnimatePresence>
                    {phase !== "typing" && (
                      <motion.div
                        {...RISE}
                        className="relative flex items-center gap-2"
                      >
                        <MapPinIcon className="size-4 shrink-0 text-primary" />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {words.address}
                          </span>
                        </div>
                        {phase === "tap" && <TapMark ms={time.tap} />}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Box>
    </div>
  )
}

// A tap: a soft circle that grows and fades on what is tapped (a
// `relative` parent).
function TapMark({ ms }: { ms: number }) {
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0.5, scale: 0.4 }}
      animate={{ opacity: 0, scale: 1.4 }}
      transition={{ duration: ms / 1000 }}
      className="pointer-events-none absolute top-1/2 left-1/3 size-10 -translate-1/2 rounded-full bg-primary/40"
    />
  )
}

type CheckPhase = "building" | "photos" | "name" | "hours" | "services"

const CHECK_ORDER: CheckPhase[] = [
  "building",
  "photos",
  "name",
  "hours",
  "services",
]

// A small copy of the page building itself (useStoryLoop): placeholders,
// then the photos, the name and rating, today's hours and the services one
// by one, then "Ready". Rests on the finished page; tap the picture to play
// it again.
function CheckPreview({ words, shared }: { words: Words; shared: Shared }) {
  const services = words.services
  const box = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<CheckPhase>("services")
  const [shown, setShown] = useState(services.length)
  const [ready, setReady] = useState(true)
  const time = SHOWCASE_LOOP.check
  const replay = useStoryLoop(
    box,
    async (wait) => {
      setReady(false)
      setShown(0)
      setPhase("building")
      await wait(time.building)
      setPhase("photos")
      await wait(time.photos)
      setPhase("name")
      await wait(time.nameIn)
      setPhase("hours")
      await wait(time.hoursIn)
      setPhase("services")
      for (let count = 1; count <= services.length; count++) {
        setShown(count)
        await wait(time.serviceIn)
      }
      await wait(time.beforeReady)
      setReady(true)
      await wait(time.ready)
    },
    () => {
      setPhase("services")
      setShown(services.length)
      setReady(true)
    }
  )
  const reached = (step: CheckPhase) =>
    CHECK_ORDER.indexOf(phase) >= CHECK_ORDER.indexOf(step)
  const hours = `${formatClock(words.hours.opens, shared.locale)}–${formatClock(words.hours.closes, shared.locale)}`

  return (
    <>
      {/* Tap the picture to play it again. */}
      <Button
        variant="ghost"
        aria-label={words.replay}
        onClick={replay}
        className="absolute inset-0 z-10 h-auto rounded-none hover:bg-transparent dark:hover:bg-transparent"
      />
      <div ref={box} className="relative w-full max-w-60">
        <Box>
          <div className="flex flex-col gap-3 px-(--card-spacing)">
            <div className="flex items-center gap-3">
              {/* The photos: four soft colour tiles. */}
              {reached("photos") ? (
                <motion.div
                  {...POP}
                  className="grid size-10 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-lg"
                >
                  <span className="bg-chart-1" />
                  <span className="bg-chart-2" />
                  <span className="bg-chart-3" />
                  <span className="bg-chart-4" />
                </motion.div>
              ) : (
                <Skeleton className="size-10 shrink-0 rounded-lg" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {reached("name") ? (
                  <motion.div
                    {...RISE}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate font-medium">
                      {shared.business}
                    </span>
                    <Rating rating={4.9} locale={shared.locale} />
                  </motion.div>
                ) : (
                  <Skeleton className="h-4 w-28" />
                )}
                {reached("hours") ? (
                  <motion.span
                    {...RISE}
                    className="truncate text-xs text-muted-foreground"
                  >
                    {words.openToday} · {hours}
                  </motion.span>
                ) : (
                  <Skeleton className="h-3 w-20" />
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              {services.map((service, index) =>
                phase === "services" && index < shown ? (
                  <motion.div
                    key={service.name}
                    {...RISE}
                    className="flex h-4 items-center justify-between gap-2"
                  >
                    <span>{service.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatPrice(service.priceMinor, "EUR", shared.locale)}
                    </span>
                  </motion.div>
                ) : (
                  <Skeleton key={service.name} className="h-4 w-full" />
                )
              )}
            </div>
          </div>
        </Box>
        {/* "Ready", stuck on the box's corner so nothing moves under it. */}
        <AnimatePresence>
          {ready && (
            <motion.span {...POP} className="absolute -top-2 -right-2">
              <Badge className="bg-success text-success-foreground">
                <CheckIcon />
                {words.ready}
              </Badge>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

// The page's link with Copy: tap it and it says "Copied". A sample, so
// nothing goes to the clipboard.
function SharePreview({ words }: { words: Words }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  function copy() {
    clearTimeout(timer.current)
    setCopied(true)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }
  return (
    <Box>
      <div className="flex flex-col gap-3 px-(--card-spacing)">
        <span className="truncate text-sm text-muted-foreground">
          {words.link}
        </span>
        <Button
          size="sm"
          onClick={copy}
          className={
            copied
              ? "w-full bg-success text-success-foreground hover:bg-success/90"
              : "w-full"
          }
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={copied ? "copied" : "copy"}
              {...POP}
              className="flex items-center gap-1"
            >
              {copied && <CheckIcon />}
              {copied ? words.copied : words.copy}
            </motion.span>
          </AnimatePresence>
        </Button>
      </div>
    </Box>
  )
}
