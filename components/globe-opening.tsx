"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { HeroGradient } from "@/components/hero-gradient"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { VoiceGlobe } from "@/components/voice-globe"
import { useReducedMotion } from "@/hooks/use-theme-colors"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"

// Opens `href` from the globe that was tapped (its element).
type OpenFromGlobe = (globe: Element, href: string) => void

const GlobeOpeningContext = createContext<OpenFromGlobe | null>(null)

// The three ways to open, on trial (the owner picks one with the buttons in
// the middle of the page, then the others go):
// 1 Rise and bloom: the globe lifts off its button to the middle of the
//   screen, then blooms out to fill it.
// 2 Container transform (m3.material.io/styles/motion/transitions): the
//   globe's circle grows into the page itself, its corners squaring off.
// 3 Ripple: a purple circle spreads out from the globe over the screen.
// Each then turns into the page's own colour and fades away to the chat.
export const GLOBE_OPENINGS = [1, 2, 3] as const
type Variant = (typeof GLOBE_OPENINGS)[number]

// Each opening's timing, in ms: when the screen is covered (the chat opens
// behind it), when the page colour starts and how long it takes, and how
// long the last fade is.
const TIMING: Record<
  Variant,
  { covered: number; wash: number; washMs: number; fadeMs: number }
> = {
  1: { covered: 1000, wash: 900, washMs: 300, fadeMs: 450 },
  2: { covered: 560, wash: 380, washMs: 300, fadeMs: 400 },
  3: { covered: 760, wash: 600, washMs: 320, fadeMs: 450 },
}

// The Material 3 curves (docs/ui-rules/motion.md).
const EASE = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  enter: "cubic-bezier(0.05, 0.7, 0.1, 1)",
  emphasized: "cubic-bezier(0.3, 0, 0, 1)",
} as const

// Where it starts: the tapped globe's centre and size, and the screen.
type Opening = {
  variant: Variant
  x: number
  y: number
  size: number
  rect: DOMRect
  href: string
}

// From a point to the screen's farthest corner.
function farthestCorner(x: number, y: number) {
  return Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))

// Marks a globe that opens the Assistant, so the trial buttons can play from
// whichever one is on screen.
export const GLOBE_MARK = { "data-globe-opening": "" } as const

// A globe opening the Assistant, the same on a computer (the floating globe)
// and a phone (the tab bar's middle button). What grows is drawn at its full
// size and only ever shrunk or clipped, so it stays sharp. Reduce Motion: the
// Assistant just opens. `trialHref` shows the trial buttons (not on that
// page itself).
export function GlobeOpeningProvider({
  trialHref,
  children,
}: {
  trialHref?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const still = useReducedMotion()
  const [variant, setVariant] = useState<Variant>(1)
  const [opening, setOpening] = useState<Opening | null>(null)
  const busy = useRef(false)
  const layer = useRef<HTMLDivElement>(null)
  const shape = useRef<HTMLDivElement>(null)
  const wash = useRef<HTMLDivElement>(null)

  // Called once the new page is on screen.
  const arrived = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    if (opening && pathname.startsWith(opening.href)) arrived.current?.()
  }, [pathname, opening])

  const play = useCallback(
    (tapped: Element, href: string, chosen: Variant) => {
      if (busy.current) return
      if (still) {
        router.push(href)
        return
      }
      const rect = tapped.getBoundingClientRect()
      busy.current = true
      setOpening({
        variant: chosen,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        size: rect.width,
        rect,
        href,
      })
    },
    [router, still]
  )

  const open = useCallback<OpenFromGlobe>(
    (tapped, href) => play(tapped, href, variant),
    [play, variant]
  )

  // Runs once the opening is on the page, before it is painted.
  useLayoutEffect(() => {
    const whole = layer.current
    const grower = shape.current
    const colour = wash.current
    if (!opening || !whole || !grower || !colour) return
    const time = TIMING[opening.variant]
    const { x, y, size, rect } = opening
    const w = window.innerWidth
    const h = window.innerHeight
    let move: Animation
    if (opening.variant === 1) {
      // A globe as big as the screen needs, centred on the screen: it starts
      // the tapped one's size on its spot, lifts to the middle a little
      // bigger, then blooms.
      const full = farthestCorner(w / 2, h / 2) * 2.2
      const lifted = Math.min(w, h) * 0.28
      move = grower.animate(
        [
          {
            transform: `translate(${x - w / 2}px, ${y - h / 2}px) scale(${size / full})`,
            easing: EASE.emphasized,
          },
          {
            offset: 0.45,
            transform: `translate(0px, 0px) scale(${lifted / full})`,
            easing: EASE.standard,
          },
          { transform: "translate(0px, 0px) scale(1)" },
        ],
        { duration: 1150, fill: "forwards" }
      )
    } else if (opening.variant === 2) {
      // The page-sized panel, clipped to the globe's circle, opens to the
      // whole screen as its corners square off.
      move = grower.animate(
        [
          {
            clipPath: `inset(${rect.top}px ${w - rect.right}px ${h - rect.bottom}px ${rect.left}px round ${size / 2}px)`,
          },
          { clipPath: "inset(0px 0px 0px 0px round 0px)" },
        ],
        { duration: 620, easing: EASE.emphasized, fill: "forwards" }
      )
    } else {
      // The panel shows through a circle spreading out from the globe.
      const reach = farthestCorner(x, y)
      move = grower.animate(
        [
          { clipPath: `circle(${size / 2}px at ${x}px ${y}px)` },
          { clipPath: `circle(${reach}px at ${x}px ${y}px)` },
        ],
        { duration: 900, easing: EASE.enter, fill: "forwards" }
      )
    }
    const turn = colour.animate([{ opacity: 0 }, { opacity: 1 }], {
      delay: time.wash,
      duration: time.washMs,
      easing: "ease-in-out",
      fill: "both",
    })
    let gone = false
    // Goes to the page once the screen is covered; resolves once it is on
    // screen, or after globeOpenWaitMs.
    const arrive = () =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ASSISTANT_RULES.globeOpenWaitMs)
        arrived.current = () => {
          clearTimeout(timer)
          arrived.current = null
          resolve()
        }
        router.push(opening.href)
      })
    const run = async () => {
      await wait(time.covered)
      if (gone) return
      await arrive()
      await turn.finished
      if (gone) return
      await whole.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: time.fadeMs,
        easing: "ease-out",
        fill: "forwards",
      }).finished
      if (gone) return
      busy.current = false
      setOpening(null)
    }
    // A cancelled animation (the owner area closing) just stops it.
    run().catch(() => {})
    return () => {
      gone = true
      arrived.current = null
      busy.current = false
      move.cancel()
      turn.cancel()
    }
  }, [opening, router])

  // Plays a trial opening from the globe that is on screen.
  const tryOpening = (chosen: Variant) => {
    setVariant(chosen)
    const globe = [...document.querySelectorAll("[data-globe-opening]")].find(
      (element) => element.getBoundingClientRect().width > 0
    )
    if (globe && trialHref) play(globe, trialHref, chosen)
  }

  const full =
    opening?.variant === 1
      ? farthestCorner(window.innerWidth / 2, window.innerHeight / 2) * 2.2
      : 0

  return (
    <GlobeOpeningContext value={open}>
      {children}
      {trialHref && !pathname.startsWith(trialHref) && !opening && (
        <ButtonGroup className="fixed top-1/2 left-1/2 z-40 -translate-x-1/2 -translate-y-1/2">
          {GLOBE_OPENINGS.map((choice) => (
            <Button
              key={choice}
              variant={choice === variant ? "default" : "outline"}
              onClick={() => tryOpening(choice)}
            >
              {choice}
            </Button>
          ))}
        </ButtonGroup>
      )}
      {opening && (
        // Over everything, the Assistant's phone page too, and it takes the
        // taps while it plays.
        <div
          ref={layer}
          aria-hidden
          className="fixed inset-0 z-50 overflow-hidden"
        >
          {opening.variant === 1 ? (
            <div
              ref={shape}
              className="absolute top-1/2 left-1/2"
              style={{
                width: full,
                height: full,
                marginLeft: -full / 2,
                marginTop: -full / 2,
              }}
            >
              <VoiceGlobe screen className="size-full" />
              <div
                ref={wash}
                className="absolute inset-0 rounded-full bg-background opacity-0"
              />
            </div>
          ) : (
            <div
              ref={shape}
              className="absolute inset-0 isolate bg-[radial-gradient(circle_at_42%_38%,var(--chart-1),var(--chart-2))]"
            >
              <HeroGradient
                look="globe"
                fadeIn={false}
                rounded={false}
                maxPixelCount={ASSISTANT_RULES.globeOpenMaxPixels}
              />
              <div
                ref={wash}
                className="absolute inset-0 bg-background opacity-0"
              />
            </div>
          )}
        </div>
      )}
    </GlobeOpeningContext>
  )
}

export function useGlobeOpening(): OpenFromGlobe {
  const open = useContext(GlobeOpeningContext)
  if (!open) throw new Error("useGlobeOpening needs a GlobeOpeningProvider")
  return open
}
