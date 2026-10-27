"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PagePhoto } from "../types"

// Follows the carousel's selected photo, for the "2/8" counter.
function useCurrentSlide(api: CarouselApi, start = 0) {
  const [current, setCurrent] = useState(start)
  useEffect(() => {
    if (!api) return
    const update = () => setCurrent(api.selectedScrollSnap())
    update()
    api.on("select", update)
    api.on("reInit", update)
    return () => {
      api.off("select", update)
      api.off("reInit", update)
    }
  }, [api])
  return current
}

// Edge to edge and swiped on a phone, two or three across on a computer.
// A tap opens the photo full screen.
export function BusinessPhotos({ photos }: { photos: PagePhoto[] }) {
  const [api, setApi] = useState<CarouselApi>()
  const current = useCurrentSlide(api)
  const [open, setOpen] = useState<number | null>(null)
  const total = photos.length
  if (total === 0) return null

  return (
    <Carousel
      setApi={setApi}
      opts={{ align: "start" }}
      aria-label="Photos"
      className="md:overflow-hidden md:rounded-xl"
    >
      <CarouselContent className="ml-0 md:-ml-2">
        {photos.map((photo, index) => (
          <CarouselItem
            key={photo.id}
            className="pl-0 md:basis-1/2 md:pl-2 lg:basis-1/3"
          >
            <button
              type="button"
              onClick={() => setOpen(index)}
              aria-label={`Photo ${index + 1} of ${total}`}
              className="relative block aspect-[4/3] w-full overflow-hidden bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/30 md:rounded-lg"
            >
              <Image
                src={photo.url}
                alt=""
                fill
                unoptimized
                priority={index === 0}
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover object-[50%_30%]"
              />
            </button>
          </CarouselItem>
        ))}
      </CarouselContent>
      <Badge
        variant="secondary"
        className="pointer-events-none absolute right-2 bottom-2 bg-background/60 tabular-nums ring-1 ring-foreground/5 backdrop-blur-2xl backdrop-saturate-150 md:hidden"
      >
        {current + 1}/{total}
      </Badge>
      <CarouselPrevious className="left-3 hidden md:inline-flex" />
      <CarouselNext className="right-3 hidden md:inline-flex" />
      {open !== null && (
        <PhotoViewer
          photos={photos}
          start={open}
          onClose={() => setOpen(null)}
        />
      )}
    </Carousel>
  )
}

// One photo large, like a phone's own gallery: the whole screen in black,
// swiped to the next, with a close button, where you are, and Google's
// credit for the photo on screen (Google asks for it wherever a photo is large).
function PhotoViewer({
  photos,
  start,
  onClose,
}: {
  photos: PagePhoto[]
  start: number
  onClose: () => void
}) {
  const [api, setApi] = useState<CarouselApi>()
  const current = useCurrentSlide(api, start)
  const total = photos.length
  const credit = photos[current]?.credit

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="inset-0 flex h-svh max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-black p-0 text-white ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">Photos</DialogTitle>
        <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
          <span className="text-sm text-white/80 tabular-nums">
            {current + 1}/{total}
          </span>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 hover:text-white"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
        <Carousel
          setApi={setApi}
          opts={{ startIndex: start }}
          aria-label="Photos"
          className="min-h-0 flex-1 *:h-full"
        >
          <CarouselContent className="ml-0 h-full">
            {photos.map((photo) => (
              <CarouselItem key={photo.id} className="relative h-full pl-0">
                <Image
                  src={photo.url}
                  alt=""
                  fill
                  unoptimized
                  sizes="100vw"
                  className="object-contain"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-4 hidden md:inline-flex" />
          <CarouselNext className="right-4 hidden md:inline-flex" />
        </Carousel>
        <p className="min-h-10 truncate px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-white/70">
          {credit &&
            (credit.uri ? (
              <a
                href={credit.uri}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:underline"
              >
                Photo by {credit.name}
              </a>
            ) : (
              <>Photo by {credit.name}</>
            ))}
        </p>
      </DialogContent>
    </Dialog>
  )
}

// How many portfolio photos the page shows; the last one says how many more there are.
const PORTFOLIO_PREVIEW = 9

// The page's photos again as a Portfolio, like Fresha's: three across on a
// phone, one big photo beside the rest on a computer. The last tile shows
// "+N" when there are more; any tile opens the full-screen viewer.
export function BusinessPortfolio({ photos }: { photos: PagePhoto[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const total = photos.length
  const shown = photos.slice(0, PORTFOLIO_PREVIEW)
  const more = total - shown.length
  return (
    <>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
        {shown.map((photo, index) => {
          const last = more > 0 && index === shown.length - 1
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpen(index)}
              aria-label={
                last
                  ? `See ${more} more photos`
                  : `Photo ${index + 1} of ${total}`
              }
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                index === 0 && "md:col-span-2 md:row-span-2"
              )}
            >
              <Image
                src={photo.url}
                alt=""
                fill
                unoptimized
                sizes="(max-width: 768px) 33vw, 25vw"
                className="object-cover"
              />
              {last && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center bg-black/40 text-2xl font-semibold text-white"
                >
                  +{more}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {open !== null && (
        <PhotoViewer
          photos={photos}
          start={open}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}
