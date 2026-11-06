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

import { VoiceGlobe } from "@/components/voice-globe"
import { useReducedMotion } from "@/hooks/use-theme-colors"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"

// Opens `href` from the globe that was tapped (its element).
type OpenFromGlobe = (globe: Element, href: string) => void

const GlobeOpeningContext = createContext<OpenFromGlobe | null>(null)

// Where it starts: the tapped globe's centre and size.
type Opening = { x: number; y: number; size: number; href: string }

// The Material 3 curves (docs/ui-rules/motion.md): emphasized for the lift
// off the button, standard for the bloom.
const EASE = {
  lift: "cubic-bezier(0.3, 0, 0, 1)",
  bloom: "cubic-bezier(0.2, 0, 0, 1)",
} as const

// From a point to the screen's farthest corner.
function farthestCorner(x: number, y: number) {
  return Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )
}

// How big the globe ends: past the screen's corners from its middle, so its
// lit edge stays off the screen.
function bloomSize() {
  return (
    farthestCorner(window.innerWidth / 2, window.innerHeight / 2) *
    2 *
    ASSISTANT_RULES.globeOpenCover
  )
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))

// A globe opening the Assistant, the same on a computer (the floating globe)
// and a phone (the tab bar's middle button): rise and bloom. The globe lifts
// off its button to the middle of the screen, a little bigger, then blooms
// out to fill it, turns into the page's own colour, and the Assistant opens
// behind it before it all fades away (timings in ASSISTANT_RULES).
//
// What grows is a second globe drawn at its full, screen-covering size and
// shrunk to the tapped one's size to start, so it only ever gets smaller than
// it is drawn and stays sharp. Reduce Motion: the Assistant just opens.
export function GlobeOpeningProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const still = useReducedMotion()
  const [opening, setOpening] = useState<Opening | null>(null)
  const busy = useRef(false)
  const layer = useRef<HTMLDivElement>(null)
  const globe = useRef<HTMLDivElement>(null)
  const wash = useRef<HTMLDivElement>(null)

  // Called once the new page is on screen.
  const arrived = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    if (opening && pathname.startsWith(opening.href)) arrived.current?.()
  }, [pathname, opening])

  const open = useCallback<OpenFromGlobe>(
    (tapped, href) => {
      if (busy.current) return
      if (still) {
        router.push(href)
        return
      }
      const rect = tapped.getBoundingClientRect()
      busy.current = true
      setOpening({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        size: rect.width,
        href,
      })
    },
    [router, still]
  )

  // Runs once the opening is on the page, before it is painted.
  useLayoutEffect(() => {
    const whole = layer.current
    const ball = globe.current
    const colour = wash.current
    if (!opening || !whole || !ball || !colour) return
    const rules = ASSISTANT_RULES
    const { x, y, size } = opening
    const w = window.innerWidth
    const h = window.innerHeight
    const full = bloomSize()
    const lifted = Math.min(w, h) * rules.globeOpenLiftShare
    const grow = ball.animate(
      [
        {
          transform: `translate(${x - w / 2}px, ${y - h / 2}px) scale(${size / full})`,
          easing: EASE.lift,
        },
        {
          offset: rules.globeOpenLiftPart,
          transform: `translate(0px, 0px) scale(${lifted / full})`,
          easing: EASE.bloom,
        },
        { transform: "translate(0px, 0px) scale(1)" },
      ],
      { duration: rules.globeOpenGrowMs, fill: "forwards" }
    )
    const turn = colour.animate([{ opacity: 0 }, { opacity: 1 }], {
      delay: rules.globeOpenWashDelayMs,
      duration: rules.globeOpenWashMs,
      easing: "ease-in-out",
      fill: "both",
    })
    let gone = false
    // Goes to the page once the screen is covered; resolves once it is on
    // screen, or after globeOpenWaitMs.
    const arrive = () =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, rules.globeOpenWaitMs)
        arrived.current = () => {
          clearTimeout(timer)
          arrived.current = null
          resolve()
        }
        router.push(opening.href)
      })
    const run = async () => {
      await wait(rules.globeOpenCoveredMs)
      if (gone) return
      await arrive()
      await turn.finished
      if (gone) return
      await whole.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: rules.globeOpenFadeMs,
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
      grow.cancel()
      turn.cancel()
    }
  }, [opening, router])

  const full = opening ? bloomSize() : 0

  return (
    <GlobeOpeningContext value={open}>
      {children}
      {opening && (
        // Over everything, the Assistant's phone page too, and it takes the
        // taps while it plays. The globe sits in the middle of the screen at
        // its full size; the animation starts it on the tapped one.
        <div
          ref={layer}
          aria-hidden
          className="fixed inset-0 z-50 overflow-hidden"
        >
          <div
            ref={globe}
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
