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

// The view transition type the reveal's CSS waits for (app/globals.css).
const REVEAL_TYPE = "assistant-open"

// View transitions with types (Chrome 125+, Safari 18.2+, Firefox 144+).
// Elsewhere the Assistant just opens.
function canReveal() {
  return (
    typeof document.startViewTransition === "function" &&
    "types" in ViewTransition.prototype
  )
}

// The reveal's circle, read by its CSS: the globe's centre and how far it
// grows (to the window's farthest corner), set while it plays.
const REVEAL_PROPS = ["--reveal-x", "--reveal-y", "--reveal-to"] as const

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
  // The reveal is playing: a second click waits for it.
  const opening = useRef(false)
  const still = useReducedMotion()
  const globe = useRef<HTMLDivElement>(null)
  const href = `/dashboard/${businessId}/assistant`
  const pathname = usePathname()
  const assistantOpen = pathname.startsWith(href)

  // Called once the new page is on screen.
  const arrived = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    if (assistantOpen) arrived.current?.()
  }, [assistantOpen])

  // Off on a phone, so its moving canvas never starts there.
  if (!desktop || assistantOpen) return null

  const ideas = IDEAS.filter(({ key }) => !closed.includes(key))

  // Goes to the Assistant; resolves once it is on screen.
  const arrive = () =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ASSISTANT_RULES.globeRevealWaitMs)
      arrived.current = () => {
        clearTimeout(timer)
        arrived.current = null
        resolve()
      }
      router.push(href)
    })

  // Material's circular reveal: the Assistant shows through a circle that
  // grows from the globe's centre to the window's farthest corner, while the
  // page under it holds still (app/globals.css, assistant-reveal). It is a
  // view transition of the whole window (developer.mozilla.org/docs/Web/API/
  // View_Transition_API), started here rather than by a React <ViewTransition>
  // on the Assistant's page, so only this click plays it: a boundary there
  // would also animate every other way in and out of the page (the phone's
  // tab bar, the menu, Back). The browser shows real pages, clipped, so it
  // stays sharp at every frame.
  const open = () => {
    const ball = globe.current
    if (opening.current) return
    // Someone asked for less motion, or the browser can't: it just opens.
    if (!ball || still || !canReveal()) {
      router.push(href)
      return
    }
    const place = ball.getBoundingClientRect()
    const x = place.left + place.width / 2
    const y = place.top + place.height / 2
    const root = document.documentElement.style
    root.setProperty("--reveal-x", `${x}px`)
    root.setProperty("--reveal-y", `${y}px`)
    root.setProperty("--reveal-to", `${farthestCorner(x, y)}px`)
    opening.current = true
    const reveal = document.startViewTransition({
      update: arrive,
      types: [REVEAL_TYPE],
    })
    void reveal.finished.finally(() => {
      for (const prop of REVEAL_PROPS) root.removeProperty(prop)
      opening.current = false
    })
  }

  const ask = (question: string) => {
    handOff(businessId, { kind: "ask", text: question })
    open()
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
        open()
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
              className="justify-start text-muted-foreground"
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
      {/* Measured for where the reveal starts. */}
      <div ref={globe} className="size-full">
        <VoiceGlobe className="size-full" />
      </div>
    </FloatingLink>
  )
}
