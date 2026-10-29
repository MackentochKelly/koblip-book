"use client"

import { MeshGradient } from "@paper-design/shaders-react"

import { Rating } from "@/components/rating"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckIcon, MapPinIcon } from "@/components/ui/icons"
import { useThemeColors } from "@/hooks/use-theme-colors"
import type { Messages } from "@/lib/i18n"

type Sample = Messages["home"]["features"]["sample"]

// The pictures on the home feature cards: a small piece of the real app,
// built from its own parts, on a still colour wash (the hero's Paper Mesh
// Gradient, not moving), a different colour per card. Pictures only:
// hidden from screen readers and not focusable.
const PREVIEWS = {
  page: { colors: ["--background", "--chart-1", "--chart-3"], seed: 0 },
  book: { colors: ["--background", "--hero-accent", "--chart-1"], seed: 40 },
  assistant: { colors: ["--background", "--verified", "--chart-2"], seed: 80 },
} as const

export type FeaturePreviewName = keyof typeof PREVIEWS

export function FeaturePreview({
  name,
  sample,
}: {
  name: FeaturePreviewName
  sample: Sample
}) {
  const colors = useThemeColors(PREVIEWS[name].colors)
  return (
    <div
      aria-hidden
      inert
      className="relative isolate flex size-full items-center justify-center p-4"
    >
      {colors && (
        <MeshGradient
          colors={colors}
          distortion={0.4}
          swirl={0.1}
          speed={0}
          frame={PREVIEWS[name].seed * 1000}
          className="absolute inset-0 -z-10 duration-700 motion-safe:animate-in motion-safe:fade-in"
        />
      )}
      {name === "page" && <PagePreview sample={sample} />}
      {name === "book" && <BookPreview sample={sample} />}
      {name === "assistant" && <AssistantPreview sample={sample} />}
    </div>
  )
}

// A business page: name, rating, Book.
function PagePreview({ sample }: { sample: Sample }) {
  return (
    <Card size="sm" className="w-full max-w-60 shadow-none">
      <div className="flex flex-col gap-3 px-(--card-spacing)">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <MapPinIcon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{sample.business}</span>
            <Rating rating={4.9} reviewCount={128} locale={sample.locale} />
          </div>
        </div>
        <Button size="sm" className="w-full">
          {sample.book}
        </Button>
      </div>
    </Card>
  )
}

// Free times for a day, one picked.
function BookPreview({ sample }: { sample: Sample }) {
  return (
    <Card size="sm" className="w-full max-w-60 shadow-none">
      <div className="flex flex-col gap-3 px-(--card-spacing)">
        <span className="font-medium">{sample.day}</span>
        <div className="flex flex-wrap gap-2">
          {sample.times.map((time, index) => (
            <Badge
              key={time}
              variant={
                index === sample.times.length - 1 ? "default" : "outline"
              }
            >
              {time}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  )
}

// The owner asks, the assistant does it.
function AssistantPreview({ sample }: { sample: Sample }) {
  return (
    <div className="flex w-full max-w-60 flex-col gap-2">
      <Bubble align="end">
        <BubbleContent>{sample.ask}</BubbleContent>
      </Bubble>
      <Bubble variant="outline">
        <BubbleContent className="flex items-center gap-1.5">
          <CheckIcon className="size-4 shrink-0 text-primary" />
          {sample.done}
        </BubbleContent>
      </Bubble>
    </div>
  )
}
