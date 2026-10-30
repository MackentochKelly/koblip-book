"use client"

import { useState } from "react"
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"

import { homeSectionTitleClassName } from "@/components/home-section-title"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { cn } from "@/lib/utils"

export type ShowcaseItem = {
  key: string
  // A number badge before the title, for steps.
  step?: number
  title: string
  text: string
  picture: React.ReactNode
}

// A titled row of cards on the home page ("How it works", "What you get"):
// the stock Card with a picture inset on top, like dev.meta.ai's model
// cards. Phones swipe (or tap the arrows); computers show all three.
export function ShowcaseRow({
  id,
  title,
  previous,
  next,
  items,
  bento = false,
}: {
  // For links to this row (the footer's).
  id: string
  title: string
  previous: string
  next: string
  items: ShowcaseItem[]
  // Computers: the first card wide and the other two narrow beside it
  // (a bento row), each picture filling its card's height.
  bento?: boolean
}) {
  // Two-finger trackpad swipes move the cards too (Embla only drags).
  const [wheel] = useState(() => WheelGesturesPlugin())
  return (
    <section id={id} className="mx-auto w-full max-w-page px-2 pb-12 sm:px-4">
      {/* The cards slide on to the screen's edge instead of being cut at
          the row's edge: the carousel doesn't clip, the page does (its
          overflow-x-clip). */}
      <Carousel
        opts={{ align: "start" }}
        plugins={[wheel]}
        className="*:data-[slot=carousel-content]:overflow-visible"
      >
        <div className="mb-4 flex items-center justify-between gap-4 px-2">
          <h2 className={homeSectionTitleClassName}>{title}</h2>
          <div className="flex gap-2 md:hidden">
            <CarouselPrevious
              className="static translate-none"
              aria-label={previous}
            />
            <CarouselNext className="static translate-none" aria-label={next} />
          </div>
        </div>
        {/* p-px: room for the card edge, which the carousel would clip. */}
        <CarouselContent className="p-px">
          {items.map((item, index) => (
            <CarouselItem
              key={item.key}
              className={cn(
                "basis-[85%]",
                !bento && "md:basis-1/3",
                bento && (index === 0 ? "md:basis-1/2" : "md:basis-1/4")
              )}
            >
              <Card className="h-full pt-2 shadow-none ring-border dark:ring-border">
                <div
                  className={cn(
                    "relative mx-2 aspect-video overflow-hidden rounded-t-[calc(var(--radius-4xl)-(--spacing(2)))] rounded-b-lg bg-muted after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:inset-ring after:inset-ring-foreground/5 dark:after:inset-ring-foreground/10",
                    bento && "md:aspect-auto md:min-h-72 md:flex-1"
                  )}
                >
                  {item.picture}
                </div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {item.step !== undefined && (
                      <Badge variant="secondary" className="tabular-nums">
                        {item.step}
                      </Badge>
                    )}
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.text}</CardDescription>
                </CardHeader>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  )
}
