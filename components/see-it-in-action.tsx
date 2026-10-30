"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { glassFrameClassName } from "@/components/glass-frame"
import { homeSectionTitleClassName } from "@/components/home-section-title"
import { ViewTabs } from "@/components/view-tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { DEMO_VIEWS, type DemoPaths, type DemoView } from "@/lib/demo-rules"
import type { Messages } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import { cn } from "@/lib/utils"

type Words = Messages["home"]["action"]

type Demo =
  | { state: "waiting" | "opening" | "failed" | "tooMany" }
  | { state: "ready"; paths: DemoPaths }

// One screen's frame: phone-sized on computers, the width of the page on
// phones.
const SCREEN = "block h-[min(50rem,80dvh)] w-full rounded-4xl"

// Computers show all three screens side by side (Tailwind's lg).
const WIDE = "(min-width: 64rem)"

// "See it in action": the real app on the visitor's own demo copy
// (features/demo, opened once by POST /api/demo when the section comes
// near, so all three screens are the same guest's). 1, the booking page;
// 2, the dashboard, where that booking arrives; 3, the AI assistant.
// Computers: the three side by side. Phones: one screen at a time with the
// shared tab row, each opened on first use and kept, so a booking started
// there survives switching tabs.
export function SeeItInAction({
  words,
  language,
}: {
  words: Words
  language: PageLanguage
}) {
  const box = useRef<HTMLElement>(null)
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
      // Computers load every screen; phones the ones opened so far.
      if (window.matchMedia(WIDE).matches) {
        setOpened([...DEMO_VIEWS])
      }
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
      className="mx-auto flex w-full max-w-page flex-col gap-4 px-2 pb-12 sm:px-4"
    >
      {/* Centred with a line under it, unlike the other sections: the real
          app running here is the page's second big moment. */}
      <div className="mb-4 flex flex-col items-center gap-1 px-2 text-center">
        <h2 className={homeSectionTitleClassName}>{words.title}</h2>
        <p className="text-balance text-muted-foreground">{words.subtitle}</p>
      </div>
      {problem ?? (
        <>
          <ViewTabs
            views={DEMO_VIEWS.map((view) => ({
              id: view,
              label: words.tabs[view],
            }))}
            value={tab}
            onChange={choose}
            ariaLabel={words.tabsLabel}
            className="self-center lg:hidden"
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {DEMO_VIEWS.map((view, index) => (
              <div
                key={view}
                className={cn(
                  "flex flex-col gap-3",
                  view !== tab && "max-lg:hidden"
                )}
              >
                <p className="hidden items-center gap-2 px-2 font-medium lg:flex">
                  <Badge variant="secondary">{index + 1}</Badge>
                  {words.steps[view]}
                </p>
                <div className={glassFrameClassName}>
                  {demo.state === "ready" && opened.includes(view) ? (
                    <iframe
                      // The booking page in the home page's language.
                      src={
                        view === "page"
                          ? `${demo.paths.page}?lang=${language}`
                          : demo.paths[view]
                      }
                      title={words.frames[view]}
                      className={cn(SCREEN, "bg-background")}
                    />
                  ) : (
                    <Skeleton className={SCREEN} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
