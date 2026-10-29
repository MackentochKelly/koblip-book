"use client"

import { useRef } from "react"
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"

import {
  FeaturePreview,
  type FeaturePreviewName,
} from "@/components/feature-preview"
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
import type { Messages } from "@/lib/i18n"

// What an owner gets, under "Works with": only features that work today
// (WhatsApp reminders are "Soon" in WorksWith, so not here). The stock Card
// with a small preview of the app inset on top, like dev.meta.ai's model cards. Phones swipe
// (or tap the arrows); computers show all three.
export function HomeFeatures({
  words,
}: {
  words: Messages["home"]["features"]
}) {
  const features: {
    preview: FeaturePreviewName
    title: string
    text: string
  }[] = [
    { preview: "page", title: words.page, text: words.pageText },
    { preview: "book", title: words.book, text: words.bookText },
    { preview: "assistant", title: words.assistant, text: words.assistantText },
  ]
  // Two-finger trackpad swipes move the cards too (Embla only drags).
  const wheel = useRef(WheelGesturesPlugin())
  return (
    <section className="mx-auto w-full max-w-5xl px-2 pb-12 sm:px-4">
      <Carousel opts={{ align: "start" }} plugins={[wheel.current]}>
        <div className="mb-4 flex items-center justify-between gap-4 px-2">
          <h2 className="font-display text-2xl font-medium tracking-tight">
            {words.title}
          </h2>
          <div className="flex gap-2 md:hidden">
            <CarouselPrevious
              className="static translate-none"
              aria-label={words.previous}
            />
            <CarouselNext
              className="static translate-none"
              aria-label={words.next}
            />
          </div>
        </div>
        {/* p-px: room for the card edge, which the carousel would clip. */}
        <CarouselContent className="p-px">
          {features.map(({ preview, title, text }) => (
            <CarouselItem key={preview} className="basis-[85%] md:basis-1/3">
              <Card className="h-full pt-2 shadow-none ring-border dark:ring-border">
                <div
                  aria-hidden
                  className="relative mx-2 aspect-video overflow-hidden rounded-t-[calc(var(--radius-4xl)-(--spacing(2)))] rounded-b-lg bg-muted after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:inset-ring after:inset-ring-foreground/5 dark:after:inset-ring-foreground/10"
                >
                  <FeaturePreview name={preview} sample={words.sample} />
                </div>
                <CardHeader>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{text}</CardDescription>
                </CardHeader>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  )
}
