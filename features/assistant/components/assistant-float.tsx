"use client"

import { usePathname, useRouter } from "next/navigation"
import { useLayoutEffect, useRef, useState } from "react"

import { FloatingLink } from "@/components/floating-link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  ChartColumnIcon,
  TagIcon,
  UserPlusIcon,
  XIcon,
} from "@/components/ui/icons"
import { VoiceGlobe } from "@/components/voice-globe"
import { useIsDesktop } from "@/hooks/use-is-desktop"
import { useReducedMotion } from "@/hooks/use-theme-colors"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import type { PageLanguage } from "@/lib/page-language"
import { cn } from "@/lib/utils"
import { useJustLoaded } from "../hooks/use-just-loaded"
import { assistantMessagesFor } from "../i18n"
import { handOff } from "../utils/ask-handoff"

// Ideas a tap sends, none of them already on Home's Ask card.
const IDEAS = [
  { key: "services", icon: TagIcon },
  { key: "week", icon: ChartColumnIcon },
  { key: "customers", icon: UserPlusIcon },
] as const

type IdeaKey = (typeof IDEAS)[number]["key"]

// From a point to the screen's farthest corner.
function farthestCorner(x: number, y: number) {
  return Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )
}

// The way into the assistant on a computer (a phone has the tab bar's middle
// button): a round globe that floats over every other page and opens the
// assistant. For a moment after the page loads, a few short ideas rest next to
// it, each on its own card that can be closed. It stays mounted on the
// assistant's own page, so a closed idea stays closed after coming back.
export function AssistantFloat({
  businessId,
  language,
}: {
  businessId: string
  language: PageLanguage
}) {
  const messages = assistantMessagesFor(language)
  const router = useRouter()
  const desktop = useIsDesktop()
  const showIdeas = useJustLoaded(ASSISTANT_RULES.floatIdeasMs)
  const [closed, setClosed] = useState<readonly IdeaKey[]>([])
  // The globe is opening: it grows over the screen, then fades off the page.
  const [opening, setOpening] = useState(false)
  const still = useReducedMotion()
  const globe = useRef<HTMLDivElement>(null)
  const wash = useRef<HTMLDivElement>(null)
  const href = `/dashboard/${businessId}/assistant`
  const pathname = usePathname()
  const assistantOpen = pathname.startsWith(href)

  // Called once the new page is on screen.
  const arrived = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    if (assistantOpen) arrived.current?.()
  }, [assistantOpen])

  // Off on a phone, so its moving canvas never starts there.
  if (!desktop || (assistantOpen && !opening)) return null

  const ideas = opening ? [] : IDEAS.filter(({ key }) => !closed.includes(key))

  // Goes to the Assistant; resolves once it is on screen.
  const arrive = () =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ASSISTANT_RULES.globeOpenWaitMs)
      arrived.current = () => {
        clearTimeout(timer)
        arrived.current = null
        resolve()
      }
      router.push(href)
    })

  // The globe grows past the screen's edges and turns into the page's own
  // colour. The page changes hidden behind it, then it all fades away to show
  // the Assistant.
  const open = async () => {
    const ball = globe.current
    const colour = wash.current
    if (opening) return
    // Someone asked for less motion: it just opens.
    if (!ball || !colour || still) {
      router.push(href)
      return
    }
    const place = ball.getBoundingClientRect()
    const scale =
      (farthestCorner(
        place.left + place.width / 2,
        place.top + place.height / 2
      ) *
        2.2) /
      place.width
    setOpening(true)
    const grow = ball.animate(
      [{ transform: "scale(1)" }, { transform: `scale(${scale})` }],
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
    await grow.ready
    await new Promise((covered) =>
      setTimeout(covered, ASSISTANT_RULES.globeOpenCoveredMs)
    )
    await arrive()
    await turn.finished
    const fade = ball.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: ASSISTANT_RULES.globeOpenFadeMs,
      easing: "ease-out",
      fill: "forwards",
    })
    await fade.finished
    grow.cancel()
    turn.cancel()
    fade.cancel()
    setOpening(false)
  }

  const ask = (question: string) => {
    handOff(businessId, { kind: "ask", text: question })
    void open()
  }

  return (
    <FloatingLink
      id="assistant"
      href={href}
      label={messages.title}
      bare
      prefetch
      onClick={(event) => {
        // A new tab or window opens as any link does.
        if (event.metaKey || event.ctrlKey || event.shiftKey) return
        event.preventDefault()
        void open()
      }}
      attached={ideas.map(({ key, icon: Icon }, order) => (
        <div
          key={key}
          className={cn(
            "group/idea relative transition-[opacity,visibility] ease-linear",
            !showIdeas && "invisible opacity-0"
          )}
          // They leave one by one, farthest from the globe first.
          style={{
            transitionDuration: `${ASSISTANT_RULES.floatIdeasFadeOutMs}ms`,
            transitionDelay: `${order * ASSISTANT_RULES.floatIdeasFadeOutGapMs}ms`,
          }}
        >
          <Card className="gap-0 p-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start text-xs font-normal text-muted-foreground [&_svg:not([class*='size-'])]:size-3.5"
              onClick={() => ask(messages.empty.suggestions[key])}
            >
              <Icon data-icon="inline-start" />
              {messages.empty.shortIdeas[key]}
            </Button>
          </Card>
          {/* Comes up with the pointer or the keyboard; always there on a
                touch screen, which has no pointer to bring it up. */}
          <Button
            type="button"
            variant="secondary"
            size="icon-xs"
            aria-label={`${messages.empty.closeIdea}: ${messages.empty.shortIdeas[key]}`}
            className="absolute -top-2 -right-2 opacity-0 group-hover/idea:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
            onClick={() => setClosed((keys) => [...keys, key])}
          >
            <XIcon />
          </Button>
        </div>
      ))}
    >
      <div
        ref={globe}
        className={cn("relative size-full", opening && "will-change-transform")}
      >
        <VoiceGlobe className="size-full" />
        <div
          ref={wash}
          className="absolute inset-0 rounded-full bg-background opacity-0"
        />
      </div>
    </FloatingLink>
  )
}
