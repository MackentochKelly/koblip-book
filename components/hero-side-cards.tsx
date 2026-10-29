"use client"

import { AnimatePresence, motion } from "motion/react"
import { useRef, useState } from "react"

import { Box, POP, RISE } from "@/components/feature-preview"
import { glassFrameClassName } from "@/components/glass-frame"
import { Rating } from "@/components/rating"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { CalendarDaysIcon, CheckIcon, MapPinIcon } from "@/components/ui/icons"
import { Spinner } from "@/components/ui/spinner"
import { useStoryLoop } from "@/hooks/use-story-loop"
import { formatClock } from "@/lib/format-booking-time"
import { formatPrice } from "@/lib/format-price"
import { initials } from "@/lib/initials"
import type { Messages } from "@/lib/i18n"
import { SHOWCASE_LOOP } from "@/lib/showcase-rules"
import { cn } from "@/lib/utils"

type Words = Messages["home"]["steps"]["sample"]
type Shared = Messages["home"]["features"]["sample"]

// The person booked in the story: the one the assistant is asked to book
// (Ana, as in "How it works").
const BOOKED = 2
// The booking already there before it: Marta, for the second service.
const EARLIER = { person: 1, service: 1, time: "11:30" }

// Where each card sits, measured from the middle of the hero so it stays
// clear of the title (max-w-3xl) and the search box (max-w-xl). `tilt` and
// `float` make each one drift a little differently.
const CARDS = {
  listing: {
    place: "top-[22%] right-[calc(50%+24rem)]",
    tilt: "-rotate-2",
    float: { duration: 7, delay: 0 },
  },
  services: {
    place: "bottom-[14%] right-[calc(50%+21rem)]",
    tilt: "rotate-1",
    float: { duration: 8, delay: 1.2 },
  },
  booking: {
    place: "top-[24%] left-[calc(50%+24rem)]",
    tilt: "rotate-2",
    float: { duration: 7.5, delay: 0.6 },
  },
  assistant: {
    place: "bottom-[16%] left-[calc(50%+21rem)]",
    tilt: "-rotate-1",
    float: { duration: 8.5, delay: 1.8 },
  },
} as const

type CardName = keyof typeof CARDS

// How far a card drifts up and back while it floats, in px.
const FLOAT_RISE = 8

// Four small pieces of the real app on each side of the hero, big screens
// only (there is no room beside the title before that). Left: what the
// owner already has, the Google Maps listing and its services. Right: what
// they get, the assistant booking a client and the booking coming in. One
// story plays across them (useStoryLoop), then rests on the full picture.
// Only a picture: hidden from screen readers and not tappable.
export function HeroSideCards({
  words,
  shared,
}: {
  words: Words
  shared: Shared
}) {
  const box = useRef<HTMLDivElement>(null)
  const services = words.services
  const [shown, setShown] = useState(services.length)
  const [reply, setReply] = useState<"none" | "thinking" | "done">("done")
  const [booked, setBooked] = useState(true)
  const time = SHOWCASE_LOOP.hero
  useStoryLoop(
    box,
    async (wait) => {
      setShown(0)
      setReply("none")
      setBooked(false)
      await wait(time.start)
      for (let count = 1; count <= services.length; count++) {
        setShown(count)
        await wait(time.serviceIn)
      }
      await wait(time.beforeAsk)
      setReply("thinking")
      await wait(time.thinking)
      setReply("done")
      await wait(time.beforeBooking)
      setBooked(true)
      await wait(time.booked)
    },
    () => {
      setShown(services.length)
      setReply("done")
      setBooked(true)
    }
  )

  return (
    <div
      ref={box}
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden min-[1400px]:block"
    >
      <SideCard name="listing" order={0}>
        <Box>
          <div className="flex items-center gap-3 px-(--card-spacing)">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/25 dark:text-primary-foreground">
              <MapPinIcon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{shared.business}</span>
              <Rating rating={4.9} reviewCount={128} locale={shared.locale} />
              <span className="truncate text-xs text-muted-foreground">
                {words.openToday}
              </span>
            </div>
          </div>
        </Box>
      </SideCard>

      <SideCard name="services" order={1}>
        <Box>
          <div className="flex flex-col gap-2 px-(--card-spacing) text-sm">
            {services.map((service, index) => (
              <div
                key={service.name}
                className="flex h-5 items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2">
                  <span className="flex size-4 items-center justify-center">
                    <AnimatePresence initial={false}>
                      {index < shown && (
                        <motion.span {...POP} className="flex">
                          <CheckIcon className="size-4 text-success" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  {service.name}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {formatPrice(service.priceMinor, "EUR", shared.locale)}
                </span>
              </div>
            ))}
          </div>
        </Box>
      </SideCard>

      <SideCard name="booking" order={2}>
        {/* Today's bookings: the one booked earlier, and the assistant's
          booking coming in on top of it. */}
        <Box>
          <div className="flex flex-col px-(--card-spacing)">
            <AnimatePresence initial={false}>
              {booked && (
                <motion.div
                  key="new"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35 }}
                  className="overflow-hidden"
                >
                  <BookingRow
                    title={words.newBooking}
                    detail={`${firstName(words.people[BOOKED])} · ${words.bookingService} · ${formatClock(words.bookingTime, shared.locale)}`}
                    icon
                  />
                  <div className="h-3" />
                </motion.div>
              )}
            </AnimatePresence>
            <BookingRow
              title={words.people[EARLIER.person]}
              detail={`${services[EARLIER.service].name} · ${formatClock(EARLIER.time, shared.locale)}`}
            />
          </div>
        </Box>
      </SideCard>

      <SideCard name="assistant" order={3}>
        {/* The assistant's chat, as on the "Just ask your AI assistant"
          card. */}
        <div className="flex min-h-28 flex-col gap-2">
          <Bubble align="end">
            <BubbleContent>{shared.ask}</BubbleContent>
          </Bubble>
          <AnimatePresence>
            {reply !== "none" && (
              <motion.div {...RISE}>
                <Bubble
                  variant="outline"
                  className={cn(
                    glassFrameClassName,
                    "w-fit rounded-[calc(var(--radius-3xl)+--spacing(1.5))]"
                  )}
                >
                  <BubbleContent className="flex min-h-10 items-center gap-1.5">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {reply === "thinking" ? (
                        <motion.span key="thinking" {...POP} className="flex">
                          <Spinner />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="done"
                          {...RISE}
                          className="flex items-center gap-1.5"
                        >
                          <CheckIcon className="size-4 shrink-0 text-success" />
                          {shared.done}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </BubbleContent>
                </Bubble>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SideCard>
    </div>
  )
}

// One card in its place: it rises in after the page loads (one after the
// other, by `order`), then floats gently up and down for good. Reduce
// Motion (MotionProvider): no rising or floating, it just fades in.
function SideCard({
  name,
  order,
  children,
}: {
  name: CardName
  order: number
  children: React.ReactNode
}) {
  const card = CARDS[name]
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 + order * 0.15 }}
      className={cn("absolute w-60", card.place)}
    >
      <motion.div
        animate={{ y: [0, -FLOAT_RISE, 0] }}
        transition={{
          ...card.float,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={card.tilt}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

// A booking in the list: the new one gets the green calendar, as on the
// "Share your link" picture; the earlier one the client's initials.
function BookingRow({
  title,
  detail,
  icon = false,
}: {
  title: string
  detail: string
  icon?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarFallback
          className={cn(icon && "bg-success text-success-foreground")}
        >
          {icon ? <CalendarDaysIcon /> : initials(title)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </div>
    </div>
  )
}

function firstName(name: string) {
  return name.split(" ")[0]
}
