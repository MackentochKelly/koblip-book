"use client"

import {
  FeaturePattern,
  type FeaturePatternName,
} from "@/components/feature-pattern"
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
// with a pattern inset on top, like dev.meta.ai's model cards. Phones swipe
// (or tap the arrows); computers show all three.
export function HomeFeatures({
  words,
}: {
  words: Messages["home"]["features"]
}) {
  const features: {
    pattern: FeaturePatternName
    title: string
    text: string
  }[] = [
    { pattern: "calm", title: words.page, text: words.pageText },
    { pattern: "zigzag", title: words.book, text: words.bookText },
    { pattern: "flow", title: words.assistant, text: words.assistantText },
  ]
  return (
    <section className="mx-auto w-full max-w-5xl px-2 pb-12 sm:px-4">
      <Carousel opts={{ align: "start" }}>
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
          {features.map(({ pattern, title, text }) => (
            <CarouselItem key={pattern} className="basis-[85%] md:basis-1/3">
              <Card className="h-full pt-2 shadow-none">
                <div
                  aria-hidden
                  className="mx-2 aspect-video overflow-hidden rounded-[calc(var(--radius-4xl)-(--spacing(2)))] bg-muted"
                >
                  <FeaturePattern name={pattern} />
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
