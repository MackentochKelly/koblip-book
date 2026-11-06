"use client"

import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

import { frostedGlassClassName } from "@/components/glass-frame"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { XIcon } from "@/components/ui/icons"
import { demoHref } from "@/lib/demo-rules"
import { HACKATHON } from "@/lib/hackathon"
import type { Messages } from "@/lib/i18n"
import { LAYOUT_MOVE } from "@/lib/motion-tokens"
import { cn } from "@/lib/utils"

// The home page's small card in the corner, where a cookie banner would
// sit: a star on GitHub, and the demo to try. It comes up once the hero
// (and its search box) is scrolled away, never covers anything people need
// and never takes the focus. Closing it, or using either button, hides it
// until the page is loaded again. The GitHub mark: GitHub's own white file on the
// purple button, never recoloured (brand.github.com/foundations/logo).
// Place it right after the hero: it watches that spot.
export function SupportBox({ words }: { words: Messages["home"]["support"] }) {
  // Closed for this visit only: every load of the page asks again.
  const [closed, setClosed] = useState(false)
  const close = () => setClosed(true)
  const [shown, setShown] = useState(false)
  const spot = useRef<HTMLDivElement>(null)

  // Shown once the spot after the hero has gone above the screen.
  useEffect(() => {
    const element = spot.current
    if (!element || closed) return
    const watcher = new IntersectionObserver(([entry]) => {
      if (entry && !entry.isIntersecting && entry.boundingClientRect.top < 0) {
        setShown(true)
        watcher.disconnect()
      }
    })
    watcher.observe(element)
    return () => watcher.disconnect()
  }, [closed])

  return (
    <>
      <div ref={spot} aria-hidden="true" />
      <AnimatePresence>
        {shown && !closed && (
          <motion.aside
            aria-label={words.title}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={LAYOUT_MOVE}
            // A phone: full width over the bottom, inside the safe area. A
            // computer: a small card in the bottom-left corner.
            className="fixed right-[max(--spacing(4),env(safe-area-inset-right))] bottom-[max(--spacing(4),env(safe-area-inset-bottom))] left-[max(--spacing(4),env(safe-area-inset-left))] z-40 md:right-auto md:bottom-[max(--spacing(6),env(safe-area-inset-bottom))] md:left-[max(--spacing(6),env(safe-area-inset-left))] md:w-sm"
          >
            {/* Floats over the page: the frosted glass the scrolled header uses
                (see-through, blurred, a soft shadow), with the theme's border
                colour as its edge so it shows on white too. */}
            <Card
              size="sm"
              className={cn(frostedGlassClassName, "ring-border")}
            >
              <CardHeader>
                <CardTitle>{words.title}</CardTitle>
                <CardDescription>{words.text}</CardDescription>
                <CardAction>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={words.close}
                    onClick={close}
                  >
                    <XIcon />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardFooter className="gap-2">
                <Button
                  className="flex-1"
                  nativeButton={false}
                  render={
                    <a
                      href={HACKATHON.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={close}
                    />
                  }
                >
                  <Image
                    src="/brands/github-invertocat-white.svg"
                    alt=""
                    width={16}
                    height={16}
                    unoptimized
                    data-icon="inline-start"
                  />
                  {words.star}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  nativeButton={false}
                  render={
                    <a
                      href={demoHref("dashboard")}
                      target="_blank"
                      rel="noreferrer"
                      onClick={close}
                    />
                  }
                >
                  {words.demo}
                </Button>
              </CardFooter>
            </Card>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
