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

// The growing globe: centred on the tapped one, as big as it ends, and how
// small it starts (the tapped globe's size).
type Opening = {
  x: number
  y: number
  size: number
  from: number
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

// A globe opening the Assistant, the same on a computer (the floating globe)
// and a phone (the tab bar's middle button): the globe grows over the whole
// screen, turns into the page's own colour, and the Assistant opens hidden
// behind it before it all fades away (timings in ASSISTANT_RULES).
//
// The growing globe is a second one drawn at its full, screen-covering size
// and shrunk to the tapped globe's size to start, so it only ever gets
// smaller than it is drawn and stays sharp; growing the small one instead
// stretched a 48 px picture many times over, soft and blurry at the edge.
// Reduce Motion: the Assistant just opens.
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
      const place = tapped.getBoundingClientRect()
      const x = place.left + place.width / 2
      const y = place.top + place.height / 2
      const size = farthestCorner(x, y) * 2 * ASSISTANT_RULES.globeOpenCover
      busy.current = true
      setOpening({ x, y, size, from: place.width / size, href })
    },
    [router, still]
  )

  // Runs once the growing globe is on the page, before it is painted.
  useLayoutEffect(() => {
    const whole = layer.current
    const ball = globe.current
    const colour = wash.current
    if (!opening || !whole || !ball || !colour) return
    let gone = false
    const grow = ball.animate(
      [{ transform: `scale(${opening.from})` }, { transform: "scale(1)" }],
      {
        duration: ASSISTANT_RULES.globeOpenGrowMs,
        easing: ASSISTANT_RULES.globeOpenGrowEase,
        fill: "forwards",
      }
    )
    const turn = colour.animate([{ opacity: 0 }, { opacity: 1 }], {
      delay: ASSISTANT_RULES.globeOpenWashDelayMs,
      duration: ASSISTANT_RULES.globeOpenWashMs,
      easing: "ease-in-out",
      fill: "both",
    })
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
      await wait(ASSISTANT_RULES.globeOpenCoveredMs)
      if (gone) return
      await arrive()
      await turn.finished
      if (gone) return
      await whole.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: ASSISTANT_RULES.globeOpenFadeMs,
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

  return (
    <GlobeOpeningContext value={open}>
      {children}
      {opening && (
        // Over everything, the Assistant's phone page too, and it takes the
        // taps while it plays.
        <div
          ref={layer}
          aria-hidden
          className="fixed inset-0 z-50 overflow-hidden"
        >
          <div
            ref={globe}
            className="absolute"
            style={{
              left: opening.x - opening.size / 2,
              top: opening.y - opening.size / 2,
              width: opening.size,
              height: opening.size,
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
