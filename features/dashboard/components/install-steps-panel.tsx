"use client"

import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import { useRef, useState } from "react"

import { BottomPanel } from "@/components/bottom-panel"
import { Box, POP, Scene } from "@/components/feature-preview"
import { TapMark } from "@/components/step-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CopyIcon,
  PlusSquareIcon,
  RefreshIcon,
  ShareUpIcon,
  StarIcon,
} from "@/components/ui/icons"
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { useStoryLoop } from "@/hooks/use-story-loop"
import { APP_NAME, APP_SHORT_NAME } from "@/lib/app-install"
import { SHOWCASE_LOOP } from "@/lib/showcase-rules"
import { cn } from "@/lib/utils"
import { useOwnerMessages } from "../i18n/provider"

// The three taps, in order, then the icon on the Home Screen.
type Phase = "share" | "sheet" | "add" | "home"
const STEPS = ["share", "sheet", "add"] as const

// The picture's colour wash, like the home page's "How it works".
const WASH = {
  colors: ["--background", "--hero-accent", "--chart-1"],
  seed: 180,
} as const

// How to add Koblip Book to an iPhone's Home Screen, shown happening like
// the home page's pictures (useStoryLoop): Share taps, Add to Home Screen
// taps, Add taps, and the icon lands on the Home Screen. The three steps sit
// under it, the one playing lit; tap one to see it (Reduce Motion shows
// the pictures only this way).
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
  const [phase, setPhase] = useState<Phase>("share")
  const [tapping, setTapping] = useState(false)

  const replay = useStoryLoop(
    box,
    async (wait) => {
      for (const step of STEPS) {
        setPhase(step)
        await wait(step === "share" ? time.beforeTap : time.sheetIn)
        setTapping(true)
        await wait(time.tap)
        setTapping(false)
      }
      setPhase("home")
      await wait(time.home)
    },
    () => {
      setTapping(false)
      setPhase("share")
    }
  )

  const labels = {
    share: t.installShare,
    sheet: t.installAdd,
    add: t.installConfirm,
  }

  return (
    <BottomPanel
      open={open}
      onClose={onClose}
      title={t.installTitle}
      footer={
        <div className="flex flex-col gap-2">
          <Button onClick={onClose}>{t.gotIt}</Button>
          <Button variant="ghost" onClick={replay}>
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
            <Box>
              <div className="flex min-h-36 flex-col justify-center px-(--card-spacing)">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={phase} {...POP}>
                    <Picture
                      phase={phase}
                      tapping={tapping}
                      tapMs={time.tap}
                      words={{
                        add: t.installAdd,
                        addButton: t.installAddButton,
                        copy: t.installCopy,
                        favorite: t.installFavorite,
                      }}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </Box>
          </Scene>
        </div>
        <ItemGroup className="gap-1">
          {STEPS.map((step, index) => (
            <Item
              key={step}
              size="sm"
              variant={phase === step ? "muted" : "default"}
              render={<button type="button" onClick={() => setPhase(step)} />}
              className="text-start"
            >
              <ItemMedia>
                <Badge
                  variant={phase === step ? "default" : "secondary"}
                  className="tabular-nums"
                >
                  {index + 1}
                </Badge>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{labels[step]}</ItemTitle>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      </div>
    </BottomPanel>
  )
}

// One step's piece of the iPhone: Safari's bar, the Share menu, the Add
// window, the Home Screen. `tapping` shows the tap on what is tapped.
function Picture({
  phase,
  tapping,
  tapMs,
  words,
}: {
  phase: Phase
  tapping: boolean
  tapMs: number
  words: { add: string; addButton: string; copy: string; favorite: string }
}) {
  if (phase === "share") {
    return (
      <div className="flex items-center gap-2">
        <span className="flex h-9 min-w-0 flex-1 items-center rounded-full bg-muted px-3 text-xs text-muted-foreground">
          <span className="truncate">koblip.com</span>
        </span>
        <span className="relative flex size-9 shrink-0 items-center justify-center text-primary">
          <ShareUpIcon className="size-5" />
          {tapping && <TapMark ms={tapMs} className="left-1/2" />}
        </span>
      </div>
    )
  }

  if (phase === "sheet") {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <MenuRow icon={<CopyIcon />}>{words.copy}</MenuRow>
        <MenuRow icon={<StarIcon />}>{words.favorite}</MenuRow>
        <MenuRow
          icon={<PlusSquareIcon />}
          tap={tapping && <TapMark ms={tapMs} />}
        >
          {words.add}
        </MenuRow>
      </div>
    )
  }

  if (phase === "add") {
    return (
      <div className="flex items-center gap-3">
        <AppIcon />
        <span className="min-w-0 flex-1 truncate font-medium">{APP_NAME}</span>
        <span className="relative">
          <Button size="xs" tabIndex={-1}>
            {words.addButton}
          </Button>
          {tapping && <TapMark ms={tapMs} className="left-1/2" />}
        </span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-4 justify-items-center gap-3">
      {[0, 1, 2].map((key) => (
        <Skeleton key={key} className="size-9 rounded-xl" />
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
        className="flex flex-col items-center gap-1"
      >
        <AppIcon />
        <span className="text-xs text-muted-foreground">{APP_SHORT_NAME}</span>
      </motion.div>
    </div>
  )
}

// A row of the Share menu; the one with `tap` is lit (Add to Home Screen).
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
    <div
      className={cn(
        "relative flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 [&_svg]:size-4",
        lit ? "bg-muted font-medium" : "text-muted-foreground"
      )}
    >
      <span className="truncate">{children}</span>
      {icon}
      {tap}
    </div>
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
