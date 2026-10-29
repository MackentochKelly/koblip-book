"use client"

import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { Box, POP, RISE, Scene } from "@/components/feature-preview"
import { Rating } from "@/components/rating"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CheckIcon,
  MapPinIcon,
  RefreshIcon,
  SearchIcon,
} from "@/components/ui/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
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

// Plays by itself (useStoryLoop): placeholders while the page builds, the
// name and rating, the services one by one, a tap turns one off and on
// again, then "Ready". Rests on the finished page, where the services can
// be tapped; the replay button plays it again.
function CheckPreview({ words, shared }: { words: Words; shared: Shared }) {
  const services = words.services
  const box = useRef<HTMLDivElement>(null)
  const [building, setBuilding] = useState(false)
  const [shown, setShown] = useState(services.length)
  const [off, setOff] = useState<string[]>([])
  const [tapped, setTapped] = useState<string | null>(null)
  const [ready, setReady] = useState(true)
  const time = SHOWCASE_LOOP.check
  const target = services[services.length - 1].name
  const replay = useStoryLoop(
    box,
    async (wait) => {
      setReady(false)
      setOff([])
      setShown(0)
      setBuilding(true)
      await wait(time.building)
      setBuilding(false)
      await wait(time.nameIn)
      for (let count = 1; count <= services.length; count++) {
        setShown(count)
        await wait(time.serviceIn)
      }
      await wait(time.beforeTap)
      setTapped(target)
      await wait(time.tap)
      setTapped(null)
      setOff([target])
      await wait(time.off)
      setTapped(target)
      await wait(time.tap)
      setTapped(null)
      setOff([])
      await wait(time.beforeReady)
      setReady(true)
      await wait(time.ready)
    },
    () => {
      setBuilding(false)
      setShown(services.length)
      setTapped(null)
      setOff([])
      setReady(true)
    }
  )

  return (
    <div ref={box} className="relative w-full max-w-60">
      <Box>
        <div className="flex flex-col gap-2 px-(--card-spacing)">
          {building ? (
            <>
              <div className="flex h-8 items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-10" />
              </div>
              {services.map((service) => (
                <Skeleton key={service.name} className="h-8 w-full" />
              ))}
            </>
          ) : (
            <>
              <motion.div
                {...RISE}
                className="flex h-8 items-center justify-between gap-2"
              >
                <span className="flex min-w-0 items-center gap-1">
                  <span className="truncate font-medium">
                    {shared.business}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={words.replay}
                    onClick={replay}
                  >
                    <RefreshIcon />
                  </Button>
                </span>
                <Rating rating={4.9} locale={shared.locale} />
              </motion.div>
              {services.map((service, index) => {
                const on = !off.includes(service.name)
                return index < shown ? (
                  <motion.div key={service.name} {...RISE}>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-pressed={on}
                      onClick={() =>
                        setOff(
                          on
                            ? [...off, service.name]
                            : off.filter((name) => name !== service.name)
                        )
                      }
                      className="relative w-full justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        <AnimatePresence initial={false}>
                          {on && (
                            <motion.span {...POP} className="flex">
                              <CheckIcon className="text-success" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                        {service.name}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatPrice(service.priceMinor, "EUR", shared.locale)}
                      </span>
                      {tapped === service.name && <TapMark ms={time.tap} />}
                    </Button>
                  </motion.div>
                ) : (
                  <div key={service.name} className="h-8" />
                )
              })}
            </>
          )}
        </div>
      </Box>
      {/* "Ready", stuck on the box's corner so nothing moves under it. */}
      <AnimatePresence>
        {ready && !building && (
          <motion.span {...POP} className="absolute -top-2 -right-2">
            <Badge className="bg-success text-success-foreground">
              <CheckIcon />
              {words.ready}
            </Badge>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
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
