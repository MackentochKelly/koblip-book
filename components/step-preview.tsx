"use client"

import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"

import {
  Box,
  burstFrom,
  PhotoAvatar,
  POP,
  ReplayButton,
  RISE,
  SAMPLE_BUSINESS,
  SAMPLE_PEOPLE,
  SAMPLE_PHOTO,
  SAMPLE_SERVICES,
  SAMPLE_TEAM,
  Scene,
  TapMark,
  useSampleLocale,
} from "@/components/feature-preview"
import { GoogleMark, googleButtonClassName } from "@/components/google-mark"
import { Rating } from "@/components/rating"
import { Button } from "@/components/ui/button"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  CalendarDaysIcon,
  CheckIcon,
  MapPinIcon,
  SearchIcon,
} from "@/components/ui/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { formatClock } from "@/lib/format-booking-time"
import { formatPrice } from "@/lib/format-price"
import { initials } from "@/lib/initials"
import { useStoryLoop } from "@/hooks/use-story-loop"
import { SHOWCASE_LOOP } from "@/lib/showcase-rules"
import { cn } from "@/lib/utils"

// The sample's owner, address, link and the AI that builds the page: the
// same in every language.
const SAMPLE_OWNER = "Lucía Gómez"
const SAMPLE_ADDRESS = "Calle Mayor 12, Madrid"
const SAMPLE_LINK = "book.koblip.com/lumen"
const SAMPLE_BUILDER = "Muse"

// The pictures on the "How it works" cards, made like FeaturePreview's:
// a small piece of the real app on a still colour wash, tap to play.
const STEPS = {
  find: { colors: ["--background", "--chart-2", "--hero-accent"], seed: 20 },
  check: { colors: ["--background", "--chart-1", "--verified"], seed: 60 },
  share: { colors: ["--background", "--hero-accent", "--chart-3"], seed: 100 },
  signIn: { colors: ["--background", "--chart-3", "--hero-accent"], seed: 140 },
} as const

export type StepPreviewName = keyof typeof STEPS

export function StepPreview({ name }: { name: StepPreviewName }) {
  return (
    <Scene {...STEPS[name]}>
      {name === "find" && <FindPreview />}
      {name === "check" && <CheckPreview />}
      {name === "share" && <SharePreview />}
      {name === "signIn" && <SignInPreview />}
    </Scene>
  )
}

type FindPhase = "typing" | "result" | "tap" | "page"

// Plays by itself (useStoryLoop): the name types in, the Google Maps
// result shows, a tap lands on it and the business page appears. Rests on
// the search with its result; Search plays it again.
function FindPreview() {
  const t = useTranslations("public.home.steps.sample")
  const locale = useSampleLocale()
  const name = SAMPLE_BUSINESS
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
                    locale={locale}
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
                      aria-label={t("search")}
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
                            {SAMPLE_ADDRESS}
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

type CheckPhase = "building" | "photos" | "name" | "services" | "team"

const CHECK_ORDER: CheckPhase[] = [
  "building",
  "photos",
  "name",
  "services",
  "team",
]

// A small copy of the page building itself (useStoryLoop) while Muse, the
// AI, works: placeholders, then the business's photo, the name and
// rating, the services and prices one by one and the team, then "Ready". Rests on the finished page; tap the picture to play it again.
function CheckPreview() {
  const t = useTranslations("public.home.steps.sample")
  const locale = useSampleLocale()
  const services = SAMPLE_SERVICES
  const box = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<CheckPhase>("team")
  const [shown, setShown] = useState<number>(services.length)
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
      setPhase("services")
      for (let count = 1; count <= services.length; count++) {
        setShown(count)
        await wait(time.serviceIn)
      }
      setPhase("team")
      await wait(time.teamIn)
      await wait(time.beforeReady)
      setReady(true)
      await wait(time.ready)
    },
    () => {
      setPhase("team")
      setShown(services.length)
      setReady(true)
    }
  )
  const reached = (step: CheckPhase) =>
    CHECK_ORDER.indexOf(phase) >= CHECK_ORDER.indexOf(step)

  return (
    <>
      <ReplayButton label={t("replay")} onClick={replay} />
      <div ref={box} className="relative w-full max-w-60">
        <Box>
          <div className="flex flex-col gap-2 px-(--card-spacing)">
            <div className="flex items-center gap-3">
              {/* The business's photo, as on the real page. */}
              {reached("photos") ? (
                <motion.div {...POP} className="flex shrink-0">
                  <PhotoAvatar src={SAMPLE_PHOTO} size="lg" />
                </motion.div>
              ) : (
                <Skeleton className="size-10 shrink-0 rounded-full" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {reached("name") ? (
                  <motion.div
                    {...RISE}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate font-medium">
                      {SAMPLE_BUSINESS}
                    </span>
                    <Rating rating={4.9} locale={locale} />
                  </motion.div>
                ) : (
                  <Skeleton className="h-4 w-28" />
                )}
                {/* The team, with their photos. */}
                {reached("team") ? (
                  <motion.div {...RISE} className="flex">
                    <AvatarGroup>
                      {SAMPLE_TEAM.map(({ photo }) => (
                        <PhotoAvatar key={photo} src={photo} size="sm" />
                      ))}
                    </AvatarGroup>
                  </motion.div>
                ) : (
                  <Skeleton className="h-6 w-16" />
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1 text-xs">
              {services.map((service, index) =>
                reached("services") && index < shown ? (
                  <motion.div
                    key={service.key}
                    {...RISE}
                    className="flex h-4 items-center justify-between gap-2"
                  >
                    <span>{t(`services.${service.key}`)}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatPrice(service.priceMinor, "EUR", locale)}
                    </span>
                  </motion.div>
                ) : (
                  <Skeleton key={service.key} className="h-4 w-full" />
                )
              )}
            </div>
          </div>
        </Box>
        {/* On the box's corner so nothing moves under it: Muse while it
            builds, then "Ready". */}
        <span className="absolute -top-2 -right-2">
          <AnimatePresence mode="wait" initial={false}>
            {ready ? (
              <motion.span key="ready" {...POP} className="flex">
                <Badge className="bg-success text-success-foreground">
                  <CheckIcon />
                  {t("ready")}
                </Badge>
              </motion.span>
            ) : (
              <motion.span key="muse" {...POP} className="flex">
                <Badge variant="secondary">
                  <Image
                    src="/brands/meta-symbol.png"
                    alt=""
                    width={12}
                    height={12}
                    data-icon="inline-start"
                    className="dark:hidden"
                  />
                  <Image
                    src="/brands/meta-symbol-white.png"
                    alt=""
                    width={12}
                    height={12}
                    data-icon="inline-start"
                    className="hidden dark:block"
                  />
                  {SAMPLE_BUILDER}
                </Badge>
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>
    </>
  )
}

type SharePhase =
  | "link"
  | "tapCopy"
  | "copied"
  | "share"
  | "scroll"
  | "tapPerson"
  | "picked"
  | "booked"

// The person who books: the third in the share row.
const PICKED = 2
// How far the share row slides: two avatars (size-10) and their gaps
// (gap-3), so the third person sits in view.
const SHARE_SLIDE = "-6.5rem"

// The link's story (useStoryLoop): Copy is tapped and says "Copied", the
// share row slides to show more people and one is picked, then that
// person's booking comes in, with confetti. Rests on the link; Copy plays
// it again. A sample, so nothing goes to the clipboard.
function SharePreview() {
  const t = useTranslations("public.home.steps.sample")
  const locale = useSampleLocale()
  const box = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<SharePhase>("link")
  const time = SHOWCASE_LOOP.share
  const replay = useStoryLoop(
    box,
    async (wait) => {
      setPhase("link")
      await wait(time.beforeTap)
      setPhase("tapCopy")
      await wait(time.tap)
      setPhase("copied")
      await wait(time.copied)
      setPhase("share")
      await wait(time.beforeScroll)
      setPhase("scroll")
      await wait(time.scroll + time.beforePersonTap)
      setPhase("tapPerson")
      await wait(time.tap)
      setPhase("picked")
      await wait(time.picked)
      setPhase("booked")
      if (box.current) burstFrom(box.current)
      await wait(time.booked)
    },
    () => setPhase("link")
  )
  const copied = phase === "copied"
  const sharing = ["share", "scroll", "tapPerson", "picked"].includes(phase)
  const slid = phase !== "share"
  const person = SAMPLE_PEOPLE[PICKED]

  return (
    <div ref={box} className="w-full max-w-60">
      <Box>
        <div className="flex min-h-20 flex-col justify-center px-(--card-spacing)">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "booked" ? (
              <motion.div
                key="booked"
                {...POP}
                className="flex items-center gap-3"
                role="status"
              >
                <Avatar size="lg">
                  <AvatarFallback className="bg-success text-success-foreground">
                    <CalendarDaysIcon />
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {t("newBooking")}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {person.split(" ")[0]} · {t("bookingService")} ·{" "}
                    {formatClock(t("bookingTime"), locale)}
                  </span>
                </div>
              </motion.div>
            ) : sharing ? (
              <motion.div key="share" {...POP} className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">
                  {t("share")}
                </span>
                <div className="-mx-1 overflow-hidden px-1 py-1">
                  <motion.div
                    className="flex gap-3"
                    animate={{ x: slid ? SHARE_SLIDE : 0 }}
                    transition={{
                      duration: time.scroll / 1000,
                      ease: "easeInOut",
                    }}
                  >
                    <Avatar size="lg">
                      <AvatarImage
                        src="/brands/whatsapp-glyph-green.svg"
                        alt="WhatsApp"
                        className="object-contain p-2"
                      />
                    </Avatar>
                    {SAMPLE_PEOPLE.map((name, index) => (
                      <span key={name} className="relative flex">
                        <Avatar
                          size="lg"
                          className={cn(
                            "transition-shadow",
                            index === PICKED &&
                              phase === "picked" &&
                              "ring-2 ring-primary"
                          )}
                        >
                          <AvatarFallback>{initials(name)}</AvatarFallback>
                        </Avatar>
                        {index === PICKED && phase === "tapPerson" && (
                          <TapMark ms={time.tap} className="left-1/2" />
                        )}
                      </span>
                    ))}
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="link" {...POP} className="flex flex-col gap-3">
                <span className="truncate text-sm text-muted-foreground">
                  {SAMPLE_LINK}
                </span>
                <Button
                  size="sm"
                  onClick={replay}
                  className={cn(
                    "relative w-full",
                    copied &&
                      "bg-success text-success-foreground hover:bg-success/90"
                  )}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={copied ? "copied" : "copy"}
                      {...POP}
                      className="flex items-center gap-1"
                    >
                      {copied && <CheckIcon />}
                      {copied ? t("copied") : t("copy")}
                    </motion.span>
                  </AnimatePresence>
                  {phase === "tapCopy" && (
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

type SignInPhase = "button" | "tap" | "loading" | "done"

// Signing in (useStoryLoop): "Continue with Google" is tapped, loads (the
// real button's spinner) and the owner is in, free. Rests on the button; the button plays it again.
function SignInPreview() {
  const t = useTranslations("public.home.steps.sample")
  const box = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<SignInPhase>("button")
  const time = SHOWCASE_LOOP.signIn
  const replay = useStoryLoop(
    box,
    async (wait) => {
      setPhase("button")
      await wait(time.beforeTap)
      setPhase("tap")
      await wait(time.tap)
      setPhase("loading")
      await wait(time.loading)
      setPhase("done")
      await wait(time.done)
    },
    () => setPhase("button")
  )

  return (
    <div ref={box} className="w-full max-w-60">
      <Box>
        <div className="flex min-h-20 flex-col justify-center px-(--card-spacing)">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "done" ? (
              <motion.div
                key="done"
                {...POP}
                className="flex items-center gap-3"
                role="status"
              >
                <Avatar size="lg">
                  <AvatarFallback className="bg-success text-success-foreground">
                    <CheckIcon />
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{SAMPLE_OWNER}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t("signedIn")}
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div key="button" {...POP} className="flex">
                <Button
                  variant="outline"
                  onClick={replay}
                  className={cn("relative w-full", googleButtonClassName)}
                >
                  {phase === "loading" ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <GoogleMark />
                  )}
                  {t("google")}
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
