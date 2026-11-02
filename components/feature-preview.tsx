"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import { AnimatePresence, motion, useInView } from "motion/react"
import Image from "next/image"
import { useRef, useState } from "react"

import { celebrate } from "@/components/celebration"
import { glassFrameClassName } from "@/components/glass-frame"
import { useHomeLook } from "@/components/home-look"
import { Rating } from "@/components/rating"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  AudioLinesIcon,
  CalendarDaysIcon,
  CheckIcon,
} from "@/components/ui/icons"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useStoryLoop } from "@/hooks/use-story-loop"
import { useThemeColors } from "@/hooks/use-theme-colors"
import { initials } from "@/lib/initials"
import type { Messages } from "@/lib/i18n"
import { SHOWCASE_LOOP, SHOWCASE_WASH_MARGIN } from "@/lib/showcase-rules"
import { cn } from "@/lib/utils"

type Home = Messages["home"]
type Sample = Home["features"]["sample"]
type Steps = Home["steps"]["sample"]

// The pictures on the home feature cards: a small piece of the real app,
// built from its own parts, on a still colour wash (the hero's Paper Mesh
// Gradient, not moving), a different colour per card. Each one plays what
// it shows by itself (useStoryLoop), and a tap plays it again.
const PREVIEWS = {
  page: { colors: ["--background", "--chart-1", "--chart-3"], seed: 0 },
  book: { colors: ["--background", "--hero-accent", "--chart-1"], seed: 40 },
  assistant: { colors: ["--background", "--verified", "--chart-2"], seed: 80 },
  language: {
    colors: ["--background", "--chart-2", "--hero-accent"],
    seed: 120,
  },
} as const

export type FeaturePreviewName = keyof typeof PREVIEWS

// The sample's box: the white card in the glass frame, as on the home
// search box, so it sits light on the colour wash.
// `className` for a roomier box (e.g. max-w-80), where a picture needs it.
export function Box({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn(glassFrameClassName, "max-w-60", className)}>
      <BoxCard>{children}</BoxCard>
    </div>
  )
}

// The white card inside a Box, for a frame drawn around it some other way.
export function BoxCard({ children }: { children: React.ReactNode }) {
  return (
    <Card size="sm" className="w-full shadow-none ring-0">
      {children}
    </Card>
  )
}

// A picture's still colour wash, with the sample centred on it.
export function Scene({
  colors: tokens,
  seed,
  featured = false,
  children,
}: {
  colors: readonly string[]
  seed: number
  // The one picture that keeps its colour wash in the "bands" look.
  featured?: boolean
  children: React.ReactNode
}) {
  const colors = useThemeColors(tokens)
  const look = useHomeLook()
  const box = useRef<HTMLDivElement>(null)
  const near = useInView(box, { margin: SHOWCASE_WASH_MARGIN })
  return (
    <div
      ref={box}
      className={cn(
        "relative isolate flex size-full items-center justify-center p-4",
        look === "calm" && "bg-muted",
        look === "glow" && "bg-soft-glow"
      )}
    >
      {near &&
        colors &&
        (look === "colour" || (look === "bands" && featured)) && (
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
  words,
}: {
  name: FeaturePreviewName
  words: Home
}) {
  const sample = words.features.sample
  return (
    <Scene {...PREVIEWS[name]} featured={name === "page"}>
      {name === "page" && <PagePreview sample={sample} />}
      {name === "book" && (
        <BookPreview sample={sample} steps={words.steps.sample} />
      )}
      {name === "assistant" && <AssistantPreview sample={sample} />}
      {name === "language" && <LanguagePreview sample={sample} />}
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

// The sample business's own pictures (the demo's Lumen Studio, in
// public/demo/lumen): a photo of the place, and its team with, for each,
// their name's place in the sample's `people`.
export const SAMPLE_PHOTO = "/demo/lumen/01.jpg"
export const SAMPLE_TEAM = [
  { person: 1, photo: "/demo/lumen/team-01.webp" },
  { person: 4, photo: "/demo/lumen/team-02.webp" },
  { person: 0, photo: "/demo/lumen/team-03.webp" },
] as const

// The Avatar's own sizes, for its photo's pixels.
const AVATAR_PX = { sm: 24, default: 32, lg: 40 } as const

// An Avatar showing one of the sample's photos (resized by next/image).
export function PhotoAvatar({
  src,
  size = "default",
  className,
}: {
  src: string
  size?: keyof typeof AVATAR_PX
  className?: string
}) {
  return (
    <Avatar size={size} className={className}>
      <Image
        src={src}
        alt=""
        width={AVATAR_PX[size]}
        height={AVATAR_PX[size]}
        className="size-full rounded-full object-cover"
      />
    </Avatar>
  )
}

// Covers a picture: tap anywhere on it to play its story again.
export function ReplayButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      aria-label={label}
      onClick={onClick}
      className="absolute inset-0 z-10 h-auto rounded-none hover:bg-transparent dark:hover:bg-transparent"
    />
  )
}

// A tap: a soft circle that grows and fades on what is tapped (a
// `relative` parent).
export function TapMark({ ms, className }: { ms: number; className?: string }) {
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0.5, scale: 0.4 }}
      animate={{ opacity: 0, scale: 1.4 }}
      transition={{ duration: ms / 1000 }}
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/3 size-10 -translate-1/2 rounded-full bg-primary/40",
        className
      )}
    />
  )
}

// A business page built from its Google Maps listing (the corner says
// where from): photo, name, rating, Book. Plays by itself (useStoryLoop):
// Book is tapped and turns "Booked", with confetti. Rests on Book; Book
// plays it again.
export function PagePreview({ sample }: { sample: Sample }) {
  const box = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<"book" | "tap" | "booked">("book")
  const time = SHOWCASE_LOOP.page
  const replay = useStoryLoop(
    box,
    async (wait) => {
      setPhase("book")
      await wait(time.beforeTap)
      setPhase("tap")
      await wait(time.tap)
      setPhase("booked")
      if (box.current) burstFrom(box.current)
      await wait(time.booked)
    },
    () => setPhase("book")
  )
  const booked = phase === "booked"
  return (
    <div ref={box} className="relative w-full max-w-60">
      <Box>
        <div className="flex flex-col gap-3 px-(--card-spacing)">
          <div className="flex items-center gap-3">
            <PhotoAvatar src={SAMPLE_PHOTO} size="lg" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{sample.business}</span>
              <Rating rating={4.9} reviewCount={128} locale={sample.locale} />
            </div>
          </div>
          <Button
            size="sm"
            onClick={replay}
            className={cn(
              "relative w-full",
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
            {phase === "tap" && <TapMark ms={time.tap} className="left-1/2" />}
          </Button>
        </div>
      </Box>
      <Badge variant="secondary" className="absolute -top-2 -right-2">
        <Image
          src="/brands/google-maps.svg"
          alt=""
          width={12}
          height={12}
          data-icon="inline-start"
        />
        Google Maps
      </Badge>
    </div>
  )
}

type BookPhase = "none" | "service" | "member" | "time"

const BOOK_ORDER: BookPhase[] = ["none", "service", "member", "time"]

// Booking on the page (useStoryLoop): a service, then who does it, then a
// free time, each tapped in turn, then "Confirmed". Rests on the booking
// made; tap the picture to play it again.
export function BookPreview({
  sample,
  steps,
}: {
  sample: Sample
  steps: Steps
}) {
  const box = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<BookPhase>("time")
  const [tapping, setTapping] = useState(false)
  const time = SHOWCASE_LOOP.book
  const replay = useStoryLoop(
    box,
    async (wait) => {
      setPhase("none")
      await wait(time.start)
      for (const next of BOOK_ORDER.slice(1)) {
        setTapping(true)
        await wait(time.tap)
        setTapping(false)
        setPhase(next)
        await wait(time.step)
      }
      await wait(time.confirmed)
    },
    () => {
      setTapping(false)
      setPhase("time")
    }
  )
  const reached = (step: BookPhase) =>
    BOOK_ORDER.indexOf(phase) >= BOOK_ORDER.indexOf(step)
  // What is tapped next: the first of each row.
  const next = BOOK_ORDER[BOOK_ORDER.indexOf(phase) + 1]
  const [service] = steps.services
  const [member] = SAMPLE_TEAM
  const [first] = sample.times
  return (
    <>
      <ReplayButton label={steps.replay} onClick={replay} />
      <div ref={box} className="relative w-full max-w-60">
        <Box>
          <div className="flex flex-col gap-2 px-(--card-spacing)">
            <div className="flex gap-2">
              {steps.services.map(({ name }) => (
                <Badge
                  key={name}
                  variant={
                    name === service.name && reached("service")
                      ? "default"
                      : "outline"
                  }
                  className="relative h-6"
                >
                  {name}
                  {tapping && next === "service" && name === service.name && (
                    <TapMark ms={time.tap} className="left-1/2" />
                  )}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              {SAMPLE_TEAM.map(({ photo }) => (
                <span key={photo} className="relative flex">
                  <PhotoAvatar
                    src={photo}
                    size="sm"
                    className={cn(
                      "transition-shadow",
                      photo === member.photo &&
                        reached("member") &&
                        "ring-2 ring-primary"
                    )}
                  />
                  {tapping && next === "member" && photo === member.photo && (
                    <TapMark ms={time.tap} className="left-1/2" />
                  )}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              {/* Two times: a third doesn't fit a phone's picture. */}
              {sample.times.slice(0, 2).map((slot) => (
                <Badge
                  key={slot}
                  variant={
                    slot === first && reached("time") ? "default" : "outline"
                  }
                  className="relative h-6"
                >
                  {slot}
                  {tapping && next === "time" && slot === first && (
                    <TapMark ms={time.tap} className="left-1/2" />
                  )}
                </Badge>
              ))}
            </div>
          </div>
        </Box>
        {/* On the box's corner so nothing moves under it. */}
        <AnimatePresence>
          {reached("time") && (
            <motion.span
              {...POP}
              role="status"
              className="absolute -top-2 -right-2"
            >
              <Badge className="bg-success text-success-foreground">
                <CheckIcon />
                {sample.confirmed}
              </Badge>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

// The voice wave while the owner speaks: bars that grow and shrink.
const WAVE = [0.5, 1, 0.7, 0.9, 0.4]

// The owner asks, out loud, and the assistant does it (useStoryLoop): the
// voice wave, the words they said, thinking, then the answer. Rests on the
// answer; the question plays it again.
export function AssistantPreview({ sample }: { sample: Sample }) {
  const box = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<"listening" | "thinking" | "done">("done")
  const time = SHOWCASE_LOOP.assistant
  const replay = useStoryLoop(
    box,
    async (wait) => {
      setStep("listening")
      await wait(time.listening)
      setStep("thinking")
      await wait(time.thinking)
      setStep("done")
      await wait(time.done)
    },
    () => setStep("done")
  )
  return (
    <div ref={box} className="flex w-full max-w-60 flex-col gap-2">
      <Bubble align="end">
        <BubbleContent
          render={<button type="button" onClick={replay} />}
          className="min-h-10"
        >
          <AnimatePresence mode="wait" initial={false}>
            {step === "listening" ? (
              <motion.span
                key="voice"
                {...POP}
                aria-hidden
                className="flex h-5 items-center gap-1"
              >
                <AudioLinesIcon className="size-4" />
                {WAVE.map((height, index) => (
                  <motion.span
                    key={index}
                    className="h-4 w-1 rounded-full bg-current"
                    initial={{ scaleY: 0.3 }}
                    animate={{ scaleY: [0.3, height, 0.3] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: index * 0.1,
                    }}
                  />
                ))}
              </motion.span>
            ) : (
              <motion.span key="ask" {...RISE} className="flex">
                {sample.ask}
              </motion.span>
            )}
          </AnimatePresence>
        </BubbleContent>
      </Bubble>
      {/* The answer waits until the owner has spoken. */}
      <Bubble
        variant="outline"
        className={cn(
          glassFrameClassName,
          "w-fit rounded-[calc(var(--radius-3xl)+--spacing(1.5))] transition-opacity",
          step === "listening" && "opacity-0"
        )}
      >
        <BubbleContent
          className="flex min-h-10 items-center gap-1.5"
          role="status"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {step === "done" ? (
              <motion.span
                key="done"
                {...RISE}
                className="flex items-center gap-1.5"
              >
                <CheckIcon className="size-4 shrink-0 text-success" />
                {sample.done}
              </motion.span>
            ) : (
              <motion.span key="thinking" {...POP} className="flex">
                <Spinner />
              </motion.span>
            )}
          </AnimatePresence>
        </BubbleContent>
      </Bubble>
    </div>
  )
}

// The page in each language: tap one and the page's words switch to it.
export function LanguagePreview({ sample }: { sample: Sample }) {
  const [shown, setShown] = useState(sample.languages[0].label)
  const page =
    sample.languages.find((language) => language.label === shown) ??
    sample.languages[0]
  return (
    <Box>
      <div className="flex flex-col gap-3 px-(--card-spacing)">
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[shown]}
          onValueChange={(value) => {
            if (value[0]) setShown(value[0])
          }}
        >
          {sample.languages.map((language) => (
            <ToggleGroupItem key={language.label} value={language.label}>
              {language.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={shown} {...RISE} className="flex flex-col gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{sample.business}</span>
              <span className="truncate text-xs text-muted-foreground">
                {page.open}
              </span>
            </div>
            <Button size="sm" tabIndex={-1} className="w-full">
              {page.book}
            </Button>
          </motion.div>
        </AnimatePresence>
      </div>
    </Box>
  )
}

// A booking in the list: the new one gets the green calendar, as on the
// "Share your link" picture; the earlier one the client's initials.
export function BookingRow({
  title,
  detail,
  icon = false,
}: {
  title: string
  detail: string
  icon?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarFallback
          className={cn(icon && "bg-success text-success-foreground")}
        >
          {icon ? <CalendarDaysIcon /> : initials(title)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </div>
    </div>
  )
}

export function firstName(name: string) {
  return name.split(" ")[0]
}
