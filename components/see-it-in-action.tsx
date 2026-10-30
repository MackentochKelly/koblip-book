"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  glassButtonClassName,
  heroEdgeClassName,
} from "@/components/glass-frame"
import { HeroGradient } from "@/components/hero-gradient"
import { useHomeLook } from "@/components/home-look"
import { homeSectionTitleClassName } from "@/components/home-section-title"
import { PhoneMockup } from "@/components/phone-mockup"
import { ViewTabs } from "@/components/view-tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { DEMO_VIEWS, type DemoPaths, type DemoView } from "@/lib/demo-rules"
import type { Messages } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import { cn } from "@/lib/utils"

type Words = Messages["home"]["action"]

type Demo =
  | { state: "waiting" | "opening" | "failed" | "tooMany" }
  | { state: "ready"; paths: DemoPaths }

// The phone's height: short enough that the whole panel fits on the
// screen.
const SCREEN = "h-[min(44rem,72dvh)]"

// "See it in action": the real app on the visitor's own demo copy
// (features/demo, opened once by POST /api/demo when the section comes
// near, so all three screens are the same guest's). 1, the booking page;
// 2, the dashboard, where that booking arrives; 3, the AI assistant.
// Like the feature demos of big apps: one panel on the hero's colour wash,
// one screen at a time. Computers pick the step from the list beside it;
// phones from the shared tab row above it. Each screen opens on first use
// and is kept, so a booking started there survives switching steps.
export function SeeItInAction({
  words,
  language,
}: {
  words: Words
  language: PageLanguage
}) {
  const box = useRef<HTMLElement>(null)
  const look = useHomeLook()
  const calm = look !== "colour"
  const [demo, setDemo] = useState<Demo>({ state: "waiting" })
  const [tab, setTab] = useState<DemoView>("page")
  const [opened, setOpened] = useState<DemoView[]>(["page"])

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

  function choose(view: DemoView) {
    setTab(view)
    setOpened((list) => (list.includes(view) ? list : [...list, view]))
  }

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
      // Extra room above: the page's second big moment gets space to
      // breathe (a band's own padding replaces it in the bands look).
      className="mx-auto flex w-full max-w-page flex-col gap-4 px-2 pt-12 pb-12 sm:px-4 sm:pt-24"
    >
      {/* Centred with a line under it, unlike the other sections: the real
          app running here is the page's second big moment. */}
      <div className="mb-4 flex flex-col items-center gap-1 px-2 text-center">
        <h2 className={homeSectionTitleClassName}>{words.title}</h2>
        <p className="text-balance text-muted-foreground">{words.subtitle}</p>
      </div>
      <div
        className={cn(
          "relative isolate overflow-hidden rounded-4xl p-3 sm:p-6 lg:p-10",
          look === "colour" && heroEdgeClassName,
          look === "calm" && "bg-muted",
          look === "glow" && "bg-soft-glow ring-1 ring-border"
        )}
      >
        {!calm && <HeroGradient />}
        {problem ?? (
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 lg:flex-row lg:items-center lg:justify-center lg:gap-12">
            <ViewTabs
              views={DEMO_VIEWS.map((view) => ({
                id: view,
                label: words.tabs[view],
              }))}
              value={tab}
              onChange={choose}
              ariaLabel={words.tabsLabel}
              className="lg:hidden"
            />
            <div
              role="group"
              aria-label={words.tabsLabel}
              className="hidden w-80 flex-col gap-2 lg:flex"
            >
              {DEMO_VIEWS.map((view, index) => (
                <Item
                  key={view}
                  render={<button type="button" />}
                  aria-pressed={view === tab}
                  onClick={() => choose(view)}
                  className={cn(
                    "text-left",
                    calm
                      ? view === tab
                        ? look === "bands"
                          ? "border-foreground/15 bg-foreground/10"
                          : "border-border bg-background"
                        : look === "bands"
                          ? "hover:bg-foreground/5"
                          : "hover:bg-background/60"
                      : cn(
                          "text-hero-foreground",
                          view === tab
                            ? glassButtonClassName
                            : "hover:bg-glass dark:hover:bg-glass"
                        )
                  )}
                >
                  <ItemMedia>
                    <Badge variant={view === tab ? "default" : "secondary"}>
                      {index + 1}
                    </Badge>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="text-base">
                      {words.steps[view]}
                    </ItemTitle>
                    <ItemDescription
                      className={cn(!calm && "text-hero-foreground/80")}
                    >
                      {words.hints[view]}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </div>
            <div className="relative isolate max-w-full">
              {/* On the indigo band, a soft glow of the brand colour behind
                  the phone. */}
              {look === "bands" && (
                <div
                  aria-hidden
                  className="absolute -inset-12 -z-10 rounded-full bg-primary/35 blur-3xl"
                />
              )}
              <PhoneMockup className={SCREEN}>
                {DEMO_VIEWS.map((view) =>
                  demo.state === "ready" && opened.includes(view) ? (
                    <iframe
                      key={view}
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
          </div>
        )}
      </div>
    </section>
  )
}
