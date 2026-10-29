"use client"

import { AnimatePresence, motion, useInView } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { Box, POP, RISE, Scene } from "@/components/feature-preview"
import { Rating } from "@/components/rating"
import { Button } from "@/components/ui/button"
import { CheckIcon, MapPinIcon, SearchIcon } from "@/components/ui/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { formatPrice } from "@/lib/format-price"
import { useReducedMotion } from "@/hooks/use-theme-colors"
import type { Messages } from "@/lib/i18n"

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

// The find loop's timing, in ms.
const FIND_LOOP = {
  type: 130,
  beforeResult: 700,
  beforeTap: 1300,
  tap: 700,
  page: 3200,
  rounds: 3,
}

type FindPhase = "typing" | "result" | "tap" | "page"

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))

// Plays by itself while on screen: the name types in, the Google Maps
// result shows, a tap lands on it and the business page appears. Stops
// after three rounds on the search with its result (WCAG 2.2.2); Search
// plays it again. Reduce Motion: just that still picture.
function FindPreview({ words, shared }: { words: Words; shared: Shared }) {
  const name = shared.business
  const box = useRef<HTMLDivElement>(null)
  const inView = useInView(box, { amount: 0.6 })
  const still = useReducedMotion()
  const [run, setRun] = useState(0)
  const [typed, setTyped] = useState(name.length)
  const [phase, setPhase] = useState<FindPhase>("result")

  useEffect(() => {
    if (!inView || still) return
    let stopped = false
    async function play() {
      for (let round = 0; round < FIND_LOOP.rounds; round++) {
        setPhase("typing")
        for (let count = 0; count <= name.length; count++) {
          if (stopped) return
          setTyped(count)
          await wait(FIND_LOOP.type)
        }
        await wait(FIND_LOOP.beforeResult)
        if (stopped) return
        setPhase("result")
        await wait(FIND_LOOP.beforeTap)
        if (stopped) return
        setPhase("tap")
        await wait(FIND_LOOP.tap)
        if (stopped) return
        setPhase("page")
        await wait(FIND_LOOP.page)
      }
      if (stopped) return
      setTyped(name.length)
      setPhase("result")
    }
    void play()
    return () => {
      stopped = true
      setTyped(name.length)
      setPhase("result")
    }
  }, [inView, still, run, name])

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
                      onClick={() => setRun(run + 1)}
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
                        {/* The tap: a soft circle that grows and fades. */}
                        {phase === "tap" && (
                          <motion.span
                            aria-hidden
                            initial={{ opacity: 0.5, scale: 0.4 }}
                            animate={{ opacity: 0, scale: 1.4 }}
                            transition={{ duration: FIND_LOOP.tap / 1000 }}
                            className="pointer-events-none absolute top-1/2 left-1/3 size-10 -translate-1/2 rounded-full bg-primary/40"
                          />
                        )}
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

// The page, ready: name, rating and the services. Tap a service to take it
// off or put it back.
function CheckPreview({ words, shared }: { words: Words; shared: Shared }) {
  const [off, setOff] = useState<string[]>([])
  return (
    <Box>
      <div className="flex flex-col gap-2 px-(--card-spacing)">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{shared.business}</span>
          <Rating rating={4.9} locale={shared.locale} />
        </div>
        {words.services.map((service) => {
          const on = !off.includes(service.name)
          return (
            <Button
              key={service.name}
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
              className="w-full justify-between"
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
            </Button>
          )
        })}
      </div>
    </Box>
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
