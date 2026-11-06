"use client"

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react"
import Image from "next/image"
import { useId, useRef, useState } from "react"

import { BottomPanel } from "@/components/bottom-panel"
import { Box, Scene, TapMark } from "@/components/feature-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  BookmarkIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CopyIcon,
  EllipsisIcon,
  GlassesIcon,
  PlusIcon,
  PlusSquareIcon,
  RefreshIcon,
  SearchIcon,
  ShareUpIcon,
  StarIcon,
  XIcon,
} from "@/components/ui/icons"
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useElementHeight } from "@/hooks/use-element-height"
import { useStoryLoop } from "@/hooks/use-story-loop"
import { APP_SHORT_NAME } from "@/lib/app-install"
import { SHOWCASE_LOOP } from "@/lib/showcase-rules"
import { cn } from "@/lib/utils"
import { useOwnerMessages } from "../i18n/provider"

// Safari's taps on an iPhone, in order (iOS 26): ••• in the bottom bar,
// Share in its menu, View More in the share sheet, Add to Home Screen in
// the full list, Add in the last window. Then the icon on the Home Screen.
const STEPS = ["more", "share", "viewMore", "addHome", "add"] as const
type Step = (typeof STEPS)[number]
type Phase = Step | "home"

// The picture's colour wash, like the home page's "How it works".
const WASH = {
  colors: ["--background", "--hero-accent", "--chart-1"],
  seed: 180,
} as const

// Every picture in order, to slide forward or back between them.
const ORDER: Phase[] = [...STEPS, "home"]

// A picture slides in from the side it comes from (forward: from the
// right), softly blurred, like iOS moving between screens.
const SLIDE: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 32,
    filter: "blur(4px)",
  }),
  center: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -32,
    filter: "blur(4px)",
  }),
}
const SLIDE_TRANSITION = { duration: 0.6, ease: [0.32, 0.72, 0, 1] } as const

// Safari's menus and share sheet: the rows come in one after another.
const LIST: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.25 } },
}
const ROW: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] },
  },
}

// The lit step's background slides from step to step.
const HIGHLIGHT = { type: "spring", bounce: 0.15, duration: 0.7 } as const

type Words = ReturnType<typeof useOwnerMessages>["widgets"]

// How to add Koblip Book to an iPhone's Home Screen, shown happening like
// the home page's pictures (useStoryLoop): each tap in Safari plays in
// turn, then the icon lands on the Home Screen. The steps sit under it, the
// one playing lit; tap one to stop on it (Reduce Motion shows the pictures
// only this way), Play again to start over.
export function InstallStepsPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const t = useOwnerMessages().widgets
  const time = SHOWCASE_LOOP.install
  const box = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>("more")
  const [tapping, setTapping] = useState(false)
  // The step the owner tapped: the story stops and shows it.
  const [chosen, setChosen] = useState<Step | null>(null)
  const shown = chosen ?? phase
  const highlight = useId()
  // The card grows or shrinks to each step's picture at the slide's pace;
  // Reduce Motion: straight to its size.
  const [measure, contentHeight] = useElementHeight()
  const still = useReducedMotion()

  // Which way the picture slides: forward unless going back a step (React's
  // "storing information from previous renders").
  const [previous, setPrevious] = useState(shown)
  const [direction, setDirection] = useState(1)
  if (previous !== shown) {
    setPrevious(shown)
    setDirection(ORDER.indexOf(shown) >= ORDER.indexOf(previous) ? 1 : -1)
  }

  const replay = useStoryLoop(
    box,
    async (wait) => {
      for (const step of STEPS) {
        setPhase(step)
        await wait(step === "more" ? time.beforeTap : time.sheetIn)
        setTapping(true)
        await wait(time.tap)
        setTapping(false)
      }
      setPhase("home")
      await wait(time.home)
    },
    () => {
      setTapping(false)
      setPhase("more")
    },
    chosen === null
  )

  const playAgain = () => {
    setChosen(null)
    replay()
  }

  const labels: Record<Step, string> = {
    more: t.installMore,
    share: t.installShare,
    viewMore: t.installViewMore,
    addHome: t.installAdd,
    add: t.installConfirm,
  }

  return (
    <BottomPanel
      open={open}
      onClose={onClose}
      title={t.installTitle}
      footer={
        <div className="flex flex-col gap-2">
          <Button size="lg" onClick={onClose}>
            {t.gotIt}
          </Button>
          <Button variant="ghost" size="lg" onClick={playAgain}>
            <RefreshIcon data-icon="inline-start" />
            {t.playAgain}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          ref={box}
          aria-hidden
          className="aspect-4/3 overflow-hidden rounded-3xl bg-muted"
        >
          <Scene {...WASH}>
            {/* One width for every step, so the card doesn't jump. */}
            <div className="w-full max-w-80">
              <Box className="max-w-80">
                <motion.div
                  initial={false}
                  animate={{ height: contentHeight ?? "auto" }}
                  transition={still ? { duration: 0 } : SLIDE_TRANSITION}
                  className="overflow-hidden"
                >
                  <div
                    ref={measure}
                    className="flex flex-col justify-center px-(--card-spacing) py-2"
                  >
                    <AnimatePresence
                      mode="wait"
                      initial={false}
                      custom={direction}
                    >
                      <motion.div
                        key={shown}
                        custom={direction}
                        variants={SLIDE}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={SLIDE_TRANSITION}
                      >
                        <Picture
                          phase={shown}
                          tapping={tapping && chosen === null}
                          ms={time.tap}
                          t={t}
                        />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              </Box>
            </div>
          </Scene>
        </div>
        <div className="flex flex-col gap-1">
          {STEPS.map((step, index) => (
            <Item
              key={step}
              size="sm"
              render={
                <button
                  type="button"
                  aria-current={shown === step ? "step" : undefined}
                  onClick={() => setChosen(step)}
                />
              }
              className={cn(
                "relative isolate text-start transition-colors",
                shown !== step && "text-muted-foreground"
              )}
            >
              {shown === step && (
                <motion.span
                  layoutId={highlight}
                  transition={HIGHLIGHT}
                  className="absolute inset-0 -z-10 rounded-[inherit] bg-muted"
                />
              )}
              <ItemMedia>
                <Badge
                  variant={shown === step ? "default" : "secondary"}
                  className="tabular-nums transition-colors"
                >
                  {index + 1}
                </Badge>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {step === "more" ? (
                    <>
                      <span aria-hidden>{labels.more}</span>
                      <span className="sr-only">{t.installMoreSpoken}</span>
                    </>
                  ) : (
                    labels[step]
                  )}
                </ItemTitle>
              </ItemContent>
            </Item>
          ))}
        </div>
      </div>
    </BottomPanel>
  )
}

// One step's piece of Safari, the tapped part lit and, while `tapping`,
// the tap circle on it.
function Picture({
  phase,
  tapping,
  ms,
  t,
}: {
  phase: Phase
  tapping: boolean
  ms: number
  t: Words
}) {
  // Centred on a round button; on a row, near where a thumb lands.
  const tap = (centred = false) =>
    tapping && <TapMark ms={ms} className={centred ? "left-1/2" : undefined} />

  // Safari's bottom bar: back, the address, •••.
  if (phase === "more") {
    return (
      <div className="flex items-center gap-1.5 [&_svg]:size-4">
        <Round>
          <ChevronLeftIcon />
        </Round>
        <span className="flex h-9 min-w-0 flex-1 items-center justify-between gap-1 rounded-full bg-muted px-3 text-xs">
          <span className="truncate">book.koblip.com</span>
          <RefreshIcon className="shrink-0" />
        </span>
        <Round lit pressed={tapping}>
          <EllipsisIcon />
          {tap(true)}
        </Round>
      </div>
    )
  }

  // ••• opens a menu; Share is on top.
  if (phase === "share") {
    return (
      <MenuList>
        <MenuRow icon={<ShareUpIcon />} tap={tap()}>
          {t.installShareButton}
        </MenuRow>
        <MenuRow icon={<BookmarkIcon />}>{t.installBookmark}</MenuRow>
        <MenuRow icon={<PlusIcon />}>{t.installNewTab}</MenuRow>
      </MenuList>
    )
  }

  // The share sheet's round buttons; View More shows the full list.
  if (phase === "viewMore") {
    return (
      <motion.div
        variants={LIST}
        initial="hidden"
        animate="show"
        className="grid grid-cols-4 gap-1 text-center text-xs leading-tight"
      >
        <SheetButton icon={<CopyIcon />}>{t.installCopy}</SheetButton>
        <SheetButton icon={<BookmarkIcon />}>{t.installBookmark}</SheetButton>
        <SheetButton icon={<GlassesIcon />}>{t.installReadingList}</SheetButton>
        <SheetButton icon={<ChevronDownIcon />} tap={tap(true)}>
          {t.installViewMoreButton}
        </SheetButton>
      </motion.div>
    )
  }

  // The full list, Add to Home Screen at its foot.
  if (phase === "addHome") {
    return (
      <MenuList>
        <MenuRow icon={<StarIcon />}>{t.installFavorite}</MenuRow>
        <MenuRow icon={<SearchIcon />}>{t.installFind}</MenuRow>
        <MenuRow icon={<PlusSquareIcon />} tap={tap()}>
          {t.installTitle}
        </MenuRow>
      </MenuList>
    )
  }

  // The Add to Home Screen window: close, its title and Add on top, the
  // icon with the app's short name and address, and Open as Web App on
  // (Safari's default; it opens full screen like an app).
  if (phase === "add") {
    return (
      <div className="flex flex-col gap-3 [&_svg]:size-4">
        <div className="flex items-center gap-2">
          <Round>
            <XIcon />
          </Round>
          <span className="min-w-0 flex-1 truncate text-center text-xs font-medium">
            {t.installTitle}
          </span>
          <span
            className={cn(
              "relative transition-transform duration-300",
              tapping && "scale-90"
            )}
          >
            <Button size="xs" tabIndex={-1}>
              {t.installAddButton}
            </Button>
            {tap(true)}
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-muted p-2">
          <AppIcon />
          <div className="flex min-w-0 flex-col text-xs">
            <span className="truncate font-medium">{APP_SHORT_NAME}</span>
            <span className="truncate text-muted-foreground">
              book.koblip.com
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-muted p-2 text-xs">
          <span className="truncate">{t.installWebApp}</span>
          <Switch size="sm" checked readOnly tabIndex={-1} />
        </div>
      </div>
    )
  }

  // The Home Screen, Koblip's icon landing beside the others.
  return (
    <div className="grid grid-cols-4 items-start justify-items-center gap-3">
      {[0, 1, 2].map((key) => (
        <Skeleton key={key} className="size-9 rounded-xl" />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", bounce: 0.4, duration: 0.9, delay: 0.4 }}
        className="flex flex-col items-center gap-1"
      >
        <AppIcon />
        <span className="text-xs text-muted-foreground">{APP_SHORT_NAME}</span>
      </motion.div>
    </div>
  )
}

// A round Safari button (back, •••); `lit` for the one tapped, `pressed`
// while the tap lands.
function Round({
  lit = false,
  pressed = false,
  children,
}: {
  lit?: boolean
  pressed?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-full bg-muted transition-transform duration-300",
        lit && "text-primary",
        pressed && "scale-90"
      )}
    >
      {children}
    </span>
  )
}

function MenuList({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={LIST}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-0.5 text-sm"
    >
      {children}
    </motion.div>
  )
}

// A row of a Safari menu: icon, then words. The row with `tap` is the one
// tapped, lit.
function MenuRow({
  icon,
  tap,
  children,
}: {
  icon: React.ReactNode
  tap?: React.ReactNode
  children: React.ReactNode
}) {
  const lit = tap !== undefined
  return (
    <motion.div variants={ROW}>
      <div
        className={cn(
          "relative flex items-center gap-2 rounded-lg px-2 py-1.5 transition-transform duration-300 [&_svg]:size-4 [&_svg]:shrink-0",
          lit ? "bg-muted font-medium" : "text-muted-foreground",
          Boolean(tap) && "scale-95"
        )}
      >
        {icon}
        <span className="truncate">{children}</span>
        {tap}
      </div>
    </motion.div>
  )
}

// A round button of the share sheet, its name under it.
function SheetButton({
  icon,
  tap,
  children,
}: {
  icon: React.ReactNode
  tap?: React.ReactNode
  children: React.ReactNode
}) {
  const lit = tap !== undefined
  return (
    <motion.div
      variants={ROW}
      className="flex min-w-0 flex-col items-center gap-1"
    >
      <span
        className={cn(
          "relative flex size-10 items-center justify-center rounded-full bg-muted transition-transform duration-300 [&_svg]:size-4",
          lit && "text-primary",
          Boolean(tap) && "scale-90"
        )}
      >
        {icon}
        {tap}
      </span>
      <span
        className={cn(
          "text-balance",
          lit ? "font-medium" : "text-muted-foreground"
        )}
      >
        {children}
      </span>
    </motion.div>
  )
}

function AppIcon() {
  return (
    <Image
      src="/apple-icon"
      alt=""
      width={36}
      height={36}
      className="size-9 rounded-xl border"
    />
  )
}
