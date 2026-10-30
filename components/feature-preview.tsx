"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { celebrate } from "@/components/celebration"
import { glassFrameClassName } from "@/components/glass-frame"
import { useCalmHome } from "@/components/home-look"
import { Rating } from "@/components/rating"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckIcon, MapPinIcon } from "@/components/ui/icons"
import { Spinner } from "@/components/ui/spinner"
import { useThemeColors } from "@/hooks/use-theme-colors"
import type { Messages } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type Sample = Messages["home"]["features"]["sample"]

// The pictures on the home feature cards: a small piece of the real app,
// built from its own parts, on a still colour wash (the hero's Paper Mesh
// Gradient, not moving), a different colour per card. Each one can be
// tapped to play what it shows.
const PREVIEWS = {
  page: { colors: ["--background", "--chart-1", "--chart-3"], seed: 0 },
  book: { colors: ["--background", "--hero-accent", "--chart-1"], seed: 40 },
  assistant: { colors: ["--background", "--verified", "--chart-2"], seed: 80 },
} as const

export type FeaturePreviewName = keyof typeof PREVIEWS

// The sample's box: the white card in the glass frame, as on the home
// search box, so it sits light on the colour wash.
export function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn(glassFrameClassName, "max-w-60")}>
      <Card size="sm" className="w-full shadow-none ring-0">
        {children}
      </Card>
    </div>
  )
}

// A picture's still colour wash, with the sample centred on it.
export function Scene({
  colors: tokens,
  seed,
  children,
}: {
  colors: readonly string[]
  seed: number
  children: React.ReactNode
}) {
  const colors = useThemeColors(tokens)
  const calm = useCalmHome()
  return (
    <div
      className={cn(
        "relative isolate flex size-full items-center justify-center p-4",
        calm && "bg-muted"
      )}
    >
      {colors && !calm && (
        <MeshGradient
          aria-hidden
          colors={colors}
          distortion={0.4}
          swirl={0.1}
          speed={0}
          frame={seed * 1000}
          className="absolute inset-0 -z-10 duration-700 motion-safe:animate-in motion-safe:fade-in"
        />
      )}
      {children}
    </div>
  )
}

export function FeaturePreview({
  name,
  sample,
}: {
  name: FeaturePreviewName
  sample: Sample
}) {
  return (
    <Scene {...PREVIEWS[name]}>
      {name === "page" && <PagePreview sample={sample} />}
      {name === "book" && <BookPreview sample={sample} />}
      {name === "assistant" && <AssistantPreview sample={sample} />}
    </Scene>
  )
}

// Short, soft moves (MotionProvider turns them into fades for Reduce
// Motion).
export const POP = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
  transition: { duration: 0.2 },
}
export const RISE = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
  transition: { duration: 0.25 },
}

// A small burst from the button just tapped.
export function burstFrom(element: HTMLElement) {
  const box = element.getBoundingClientRect()
  celebrate({
    particleCount: 60,
    spread: 70,
    origin: {
      x: (box.left + box.width / 2) / window.innerWidth,
      y: (box.top + box.height / 2) / window.innerHeight,
    },
  })
}

// A business page: name, rating, Book. Tap Book: it turns "Booked" with
// confetti; tap again to start over.
export function PagePreview({ sample }: { sample: Sample }) {
  const [booked, setBooked] = useState(false)
  return (
    <Box>
      <div className="flex flex-col gap-3 px-(--card-spacing)">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/25 dark:text-primary-foreground">
            <MapPinIcon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{sample.business}</span>
            <Rating rating={4.9} reviewCount={128} locale={sample.locale} />
          </div>
        </div>
        <Button
          size="sm"
          aria-pressed={booked}
          onClick={(event) => {
            if (!booked) burstFrom(event.currentTarget)
            setBooked(!booked)
          }}
          className={cn(
            "w-full",
            booked && "bg-success text-success-foreground hover:bg-success/90"
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={booked ? "booked" : "book"}
              {...POP}
              className="flex items-center gap-1"
            >
              {booked && <CheckIcon />}
              {booked ? sample.booked : sample.book}
            </motion.span>
          </AnimatePresence>
        </Button>
      </div>
    </Box>
  )
}

// Free times for a day. Tap one: it is picked and "Confirmed" shows; tap it
// again to start over.
export function BookPreview({ sample }: { sample: Sample }) {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <Box>
      <div className="flex flex-col gap-3 px-(--card-spacing)">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{sample.day}</span>
          <AnimatePresence>
            {picked && (
              <motion.span
                {...RISE}
                role="status"
                className="flex items-center gap-1 text-xs font-medium text-success"
              >
                <CheckIcon className="size-3.5" />
                {sample.confirmed}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap gap-2">
          {sample.times.map((time) => (
            <Button
              key={time}
              size="sm"
              variant={picked === time ? "default" : "outline"}
              aria-pressed={picked === time}
              onClick={() => setPicked(picked === time ? null : time)}
            >
              {time}
            </Button>
          ))}
        </div>
      </div>
    </Box>
  )
}

// The owner asks, the assistant does it. Tap the question: it plays again
// (thinking, then the answer).
const THINKING_MS = 900

export function AssistantPreview({ sample }: { sample: Sample }) {
  const [step, setStep] = useState<"thinking" | "done">("done")
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  function replay() {
    clearTimeout(timer.current)
    setStep("thinking")
    timer.current = setTimeout(() => setStep("done"), THINKING_MS)
  }
  return (
    <div className="flex w-full max-w-60 flex-col gap-2">
      <Bubble align="end">
        <BubbleContent render={<button type="button" onClick={replay} />}>
          {sample.ask}
        </BubbleContent>
      </Bubble>
      <Bubble
        variant="outline"
        className={cn(
          glassFrameClassName,
          "w-fit rounded-[calc(var(--radius-3xl)+--spacing(1.5))]"
        )}
      >
        <BubbleContent
          className="flex min-h-10 items-center gap-1.5"
          role="status"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {step === "thinking" ? (
              <motion.span key="thinking" {...POP} className="flex">
                <Spinner />
              </motion.span>
            ) : (
              <motion.span
                key="done"
                {...RISE}
                className="flex items-center gap-1.5"
              >
                <CheckIcon className="size-4 shrink-0 text-success" />
                {sample.done}
              </motion.span>
            )}
          </AnimatePresence>
        </BubbleContent>
      </Bubble>
    </div>
  )
}
