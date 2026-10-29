"use client"

import { AnimatePresence, motion } from "motion/react"
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

const TYPE_MS = 70

// The search box types the business name, then the Google Maps result
// shows. Tap Search to type it again.
function FindPreview({ words, shared }: { words: Words; shared: Shared }) {
  const name = shared.business
  const [typed, setTyped] = useState(name.length)
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)
  useEffect(() => () => clearInterval(timer.current), [])
  function replay() {
    clearInterval(timer.current)
    setTyped(0)
    timer.current = setInterval(() => {
      setTyped((count) => {
        if (count + 1 >= name.length) clearInterval(timer.current)
        return Math.min(count + 1, name.length)
      })
    }, TYPE_MS)
  }
  const found = typed === name.length
  return (
    <Box>
      <div className="flex flex-col gap-3 px-(--card-spacing)">
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
        <div className="min-h-9" role="status">
          <AnimatePresence>
            {found && (
              <motion.div {...RISE} className="flex items-center gap-2">
                <MapPinIcon className="size-4 shrink-0 text-primary" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {words.address}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Box>
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
