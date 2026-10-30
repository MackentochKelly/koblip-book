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
  className,
}: {
  // For links to this row (the footer's).
  id: string
  title: string
  previous: string
  next: string
  items: ShowcaseItem[]
  className?: string
}) {
  // Two-finger trackpad swipes move the cards too (Embla only drags).
  const [wheel] = useState(() => WheelGesturesPlugin())
  return (
    <section
      id={id}
      className={cn("mx-auto w-full max-w-page px-2 pb-12 sm:px-4", className)}
    >
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
          {/* Computers show three cards: the arrows only when there are
              more. */}
          <div className={cn("flex gap-2", items.length <= 3 && "md:hidden")}>
            <CarouselPrevious
              className="static translate-none"
              aria-label={previous}
            />
            <CarouselNext className="static translate-none" aria-label={next} />
          </div>
        </div>
        {/* p-px: room for the card edge, which the carousel would clip. */}
        <CarouselContent className="p-px">
          {items.map((item) => (
            <CarouselItem key={item.key} className="basis-[85%] md:basis-1/3">
              <ShowcaseCard item={item} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  )
}

// The same cards as a still grid, two a row on computers, one on phones,
// under the title with a short line beside it (like shadcnblocks' case
// studies). Hovering a card zooms its picture a little.
export function ShowcaseGrid({
  id,
  title,
  subtitle,
  items,
}: {
  id: string
  title: string
  subtitle: string
  items: ShowcaseItem[]
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-page px-2 pb-12 sm:px-4">
      <div className="mb-6 flex flex-col gap-1 px-2 md:flex-row md:items-end md:justify-between md:gap-8">
        <h2 className={homeSectionTitleClassName}>{title}</h2>
        <p className="text-balance text-muted-foreground md:max-w-sm md:text-right">
          {subtitle}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <ShowcaseCard key={item.key} item={item} zoom />
        ))}
      </div>
    </section>
  )
}

// One card: the picture inset on top, then its title and line.
function ShowcaseCard({
  item,
  zoom = false,
}: {
  item: ShowcaseItem
  zoom?: boolean
}) {
  return (
    <Card className="group h-full pt-2 shadow-none ring-border dark:ring-border">
      <div className="relative mx-2 aspect-video overflow-hidden rounded-t-[calc(var(--radius-4xl)-(--spacing(2)))] rounded-b-lg bg-muted after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:inset-ring after:inset-ring-foreground/5 dark:after:inset-ring-foreground/10">
        <div
          className={cn(
            "size-full",
            zoom &&
              "transition-transform duration-500 ease-standard motion-safe:group-hover:scale-105"
          )}
        >
          {item.picture}
        </div>
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
  )
}
