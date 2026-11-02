"use client"

import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Box, RISE } from "@/components/feature-preview"

import {
  glassButtonClassName,
  heroEdgeClassName,
} from "@/components/glass-frame"
import { HeroGradient } from "@/components/hero-gradient"
import { useHomeLook } from "@/components/home-look"
import { HOME_SECTION_IDS, HomeBigTitle } from "@/components/home-section-title"
import { PHONE_STATUS_BAR, PhoneMockup } from "@/components/phone-mockup"
import { ViewTabs } from "@/components/view-tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item"
import {
  ArrowRightIcon,
  ExternalLinkIcon,
  MaximizeIcon,
  MinimizeIcon,
  SearchIcon,
} from "@/components/ui/icons"
import { Skeleton } from "@/components/ui/skeleton"
import { useFindBusiness } from "@/hooks/use-find-business"
import { DEMO_VIEWS, type DemoPaths, type DemoView } from "@/lib/demo-rules"
import type { Messages } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import { cn } from "@/lib/utils"

type Words = Messages["home"]["action"]

type Demo =
  | { state: "waiting" | "opening" | "failed" | "tooMany" }
  | { state: "ready"; paths: DemoPaths }

// The steps beside the phone on computers: the three screens, then 4, the
// same demo as the full app in a new tab.
const STEPS = [...DEMO_VIEWS, "try"] as const
type Step = (typeof STEPS)[number]

// The phone's height: short enough that the whole panel fits on the
// screen.
const SCREEN = "h-[min(44rem,72dvh)]"

// "See it in action": the real app on the visitor's own demo copy
// (features/demo, opened once by POST /api/demo when the section comes
// near, so all three screens are the same guest's). 1, the booking page;
// 2, the dashboard, where that booking arrives; 3, the AI assistant; 4, try
// it yourself: the same copy as the full app, in a new tab.
// Like the feature demos of big apps: one panel on the hero's colour wash,
// one screen at a time. Computers follow the steps beside the phone: the
// step you're on opens as the page's white card in its glass frame, with a
// button to the next one, and the last opens the full app. Phones pick from
// the shared tab row above it, with the step's line under it and the same
// button below; after the assistant, it opens the full app. Each screen opens on first use and is kept, so a booking
// started there survives switching steps.
export function SeeItInAction({
  words,
  findBusinessLabel,
  language,
}: {
  words: Words
  findBusinessLabel: string
  language: PageLanguage
}) {
  const findBusiness = useFindBusiness()
  const box = useRef<HTMLElement>(null)
  const look = useHomeLook()
  const calm = look !== "colour"
  const [demo, setDemo] = useState<Demo>({ state: "waiting" })
  // The screen in the phone, and the step beside it (step 4 keeps the
  // dashboard in the phone).
  const [tab, setTab] = useState<DemoView>("page")
  const [step, setStep] = useState<Step>("page")
  const [opened, setOpened] = useState<DemoView[]>(["page"])
  // Phones: the screen out of the phone, filling the window.
  const [expanded, setExpanded] = useState(false)

  const open = useCallback(async () => {
    setDemo({ state: "opening" })
    try {
      const response = await fetch("/api/demo", { method: "POST" })
      if (response.status === 429) {
        setDemo({ state: "tooMany" })
        return
      }
      if (!response.ok) {
        setDemo({ state: "failed" })
        return
      }
      const { paths } = (await response.json()) as { paths: DemoPaths }
      setDemo({ state: "ready", paths })
    } catch {
      setDemo({ state: "failed" })
    }
  }, [])

  // Opens the demo once, when the section comes near the screen, so a
  // visitor who never scrolls here makes no copy.
  useEffect(() => {
    const element = box.current
    if (!element) return
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          watcher.disconnect()
          void open()
        }
      },
      { rootMargin: "400px" }
    )
    watcher.observe(element)
    return () => watcher.disconnect()
  }, [open])

  // The booking page runs up under the phone's status bar (clearTop), so
  // it is told the bar's height, as a real iPhone tells a page (the
  // --safe-top its pinned bars keep clear of). Full screen has no bar.
  const pageFrame = useRef<HTMLIFrameElement>(null)
  const fitPage = useCallback(() => {
    const root = pageFrame.current?.contentDocument?.documentElement
    if (!root) return
    if (expanded) root.style.removeProperty("--safe-top")
    else root.style.setProperty("--safe-top", `${PHONE_STATUS_BAR}px`)
  }, [expanded])
  useEffect(fitPage, [fitPage])

  // Escape leaves full screen.
  useEffect(() => {
    if (!expanded) return
    const leave = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false)
    }
    window.addEventListener("keydown", leave)
    return () => window.removeEventListener("keydown", leave)
  }, [expanded])

  function choose(next: Step) {
    const view = next === "try" ? "dashboard" : next
    setStep(next)
    setTab(view)
    setOpened((list) => (list.includes(view) ? list : [...list, view]))
  }

  const tabs = (
    <ViewTabs
      views={DEMO_VIEWS.map((view) => ({
        id: view,
        label: words.tabs[view],
      }))}
      value={tab}
      onChange={choose}
      ariaLabel={words.tabsLabel}
      className="min-w-0"
    />
  )

  // Step 4: the visitor's same demo as the full app, in a new tab so the
  // home page stays; the booking page and the search beside it.
  const paths = demo.state === "ready" ? demo.paths : null
  const openApp = (
    <div className="flex w-full flex-col gap-2">
      <Button
        size="lg"
        className="w-full"
        disabled={!paths}
        nativeButton={false}
        render={
          <a
            href={paths?.dashboard}
            target="_blank"
            rel="noopener noreferrer"
          />
        }
      >
        {words.open.dashboard}
        <ExternalLinkIcon data-icon="inline-end" />
      </Button>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="ghost"
          disabled={!paths}
          nativeButton={false}
          render={
            <a
              href={paths ? `${paths.page}?lang=${language}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          {words.open.page}
          <ExternalLinkIcon data-icon="inline-end" />
        </Button>
        <Button variant="ghost" onClick={findBusiness}>
          <SearchIcon data-icon="inline-start" />
          {findBusinessLabel}
        </Button>
      </div>
    </div>
  )

  const nextStep = STEPS[STEPS.indexOf(step) + 1]
  const nextButton = nextStep ? (
    <Button size="lg" className="w-full" onClick={() => choose(nextStep)}>
      {words.steps[nextStep]}
      <ArrowRightIcon data-icon="inline-end" />
    </Button>
  ) : (
    openApp
  )
  // Phones have no step 4 tab: after the assistant, the full app.
  const phoneButton = tab === "assistant" ? openApp : nextButton

  const problem =
    demo.state === "failed" || demo.state === "tooMany" ? (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            {demo.state === "tooMany" ? words.tooMany : words.failed}
          </EmptyTitle>
        </EmptyHeader>
        {demo.state === "failed" && (
          <EmptyContent>
            <Button variant="outline" onClick={() => void open()}>
              {words.retry}
            </Button>
          </EmptyContent>
        )}
      </Empty>
    ) : null

  return (
    <section
      ref={box}
      id={HOME_SECTION_IDS.action}
      className="mx-auto flex w-full max-w-page flex-col gap-4 px-2 sm:px-4"
    >
      <HomeBigTitle
        start={words.titleStart}
        end={words.titleEnd}
        line={words.subtitle}
      />
      <div
        className={cn(
          "relative isolate rounded-4xl p-3 sm:p-6 lg:p-10",
          // Safari clips a fixed child to a rounded box that hides its
          // overflow, so the full screen lifts that.
          !expanded && "overflow-hidden",
          // The glass edge would draw over the full screen.
          look === "colour" && !expanded && heroEdgeClassName,
          look === "calm" && "bg-muted",
          look === "glow" && "bg-soft-glow ring-1 ring-border",
          // Full screen: above the page's pinned header.
          expanded && "z-50"
        )}
      >
        {!calm && <HeroGradient />}
        {problem ?? (
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 lg:grid lg:grid-cols-2 lg:gap-16">
            {/* Phones: the steps, and a button that takes the screen full
                screen, with the step's line under them. */}
            <div className="flex max-w-full items-center gap-2 lg:hidden">
              {tabs}
              <Button
                variant="outline"
                size="icon"
                aria-label={words.expand}
                onClick={() => setExpanded(true)}
              >
                <MaximizeIcon />
              </Button>
            </div>
            <p
              className={cn(
                "text-center text-balance lg:hidden",
                calm ? "text-muted-foreground" : "text-hero-foreground"
              )}
            >
              {words.hints[tab]}
            </p>
            <div
              role="group"
              aria-label={words.tabsLabel}
              className="hidden w-full max-w-md flex-col gap-2 justify-self-end lg:flex"
            >
              {STEPS.map((view, index) =>
                view === step ? (
                  <Box key={view} className="max-w-none">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={view}
                        {...RISE}
                        aria-current="step"
                        className="flex flex-col gap-4 px-(--card-spacing)"
                      >
                        <div className="flex flex-col gap-2">
                          <Badge>{index + 1}</Badge>
                          <h3 className="font-display text-2xl font-medium tracking-tight">
                            {words.steps[view]}
                          </h3>
                          <p className="text-base text-muted-foreground">
                            {words.hints[view]}
                          </p>
                        </div>
                        {nextButton}
                      </motion.div>
                    </AnimatePresence>
                  </Box>
                ) : (
                  <Item
                    key={view}
                    render={<button type="button" />}
                    onClick={() => choose(view)}
                    className={cn(
                      "text-left",
                      calm
                        ? look === "bands"
                          ? "hover:bg-foreground/5"
                          : "hover:bg-background/60"
                        : cn("text-hero-foreground", glassButtonClassName)
                    )}
                  >
                    <ItemMedia>
                      <Badge variant="secondary">{index + 1}</Badge>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="text-base">
                        {words.steps[view]}
                      </ItemTitle>
                    </ItemContent>
                  </Item>
                )
              )}
            </div>
            <div className="relative isolate lg:justify-self-start">
              {/* On the indigo band, a soft glow of the brand colour behind
                  the phone. */}
              {look === "bands" && (
                <div
                  aria-hidden
                  className="absolute -inset-12 -z-10 rounded-full bg-primary/35 blur-3xl"
                />
              )}
              <PhoneMockup
                className={SCREEN}
                // The booking page opens on its photos: they run up under
                // the Dynamic Island, as on a real iPhone.
                clearTop={tab === "page"}
                expanded={expanded}
                topBar={
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 pt-[max(env(safe-area-inset-top),--spacing(2))] pb-2">
                    {tabs}
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={words.shrink}
                      onClick={() => setExpanded(false)}
                    >
                      <MinimizeIcon />
                    </Button>
                  </div>
                }
              >
                {DEMO_VIEWS.map((view) =>
                  demo.state === "ready" && opened.includes(view) ? (
                    <iframe
                      key={view}
                      ref={view === "page" ? pageFrame : undefined}
                      onLoad={view === "page" ? fitPage : undefined}
                      // The booking page in the home page's language.
                      src={
                        view === "page"
                          ? `${demo.paths.page}?lang=${language}`
                          : demo.paths[view]
                      }
                      title={words.frames[view]}
                      className={cn(
                        "w-full flex-1 bg-background",
                        view !== tab && "hidden"
                      )}
                    />
                  ) : (
                    view === tab && (
                      <Skeleton key={view} className="flex-1 rounded-none" />
                    )
                  )
                )}
              </PhoneMockup>
            </div>
            <div className="w-full max-w-md lg:hidden">{phoneButton}</div>
          </div>
        )}
      </div>
    </section>
  )
}
