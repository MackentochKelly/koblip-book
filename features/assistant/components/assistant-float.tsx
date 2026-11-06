"use client"

import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"

import { FloatingLink } from "@/components/floating-link"
import { useGlobeOpening } from "@/components/globe-opening"
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
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { cn } from "@/lib/utils"
import { useJustLoaded } from "../hooks/use-just-loaded"
import { handOff } from "../utils/ask-handoff"

// Ideas a tap sends, none of them already on Home's Ask card.
const IDEAS = [
  { key: "services", icon: TagIcon },
  { key: "week", icon: ChartColumnIcon },
  { key: "customers", icon: UserPlusIcon },
] as const

type IdeaKey = (typeof IDEAS)[number]["key"]

// The way into the assistant on a computer (a phone has the tab bar's middle
// button): a round globe that floats over every other page and opens the
// assistant. For a moment after the page loads, a few short ideas rest next to
// it, each on its own card that can be closed. It stays mounted on the
// assistant's own page, so a closed idea stays closed after coming back.
export function AssistantFloat({ businessId }: { businessId: string }) {
  const t = useTranslations("assistant")
  const router = useRouter()
  const openFromGlobe = useGlobeOpening()
  const desktop = useIsDesktop()
  const showIdeas = useJustLoaded(ASSISTANT_RULES.floatIdeasMs)
  const [closed, setClosed] = useState<readonly IdeaKey[]>([])
  const globe = useRef<HTMLDivElement>(null)
  const href = `/dashboard/${businessId}/assistant`
  const pathname = usePathname()
  const assistantOpen = pathname.startsWith(href)

  // Off on a phone, so its moving canvas never starts there.
  if (!desktop || assistantOpen) return null

  const ideas = IDEAS.filter(({ key }) => !closed.includes(key))

  // The globe grows over the screen and opens the Assistant behind it, the
  // same as the phone's tab bar globe (components/globe-opening.tsx).
  const open = () => {
    if (globe.current) openFromGlobe(globe.current, href)
    else router.push(href)
  }

  const ask = (question: string) => {
    handOff(businessId, { kind: "ask", text: question })
    open()
  }

  return (
    <FloatingLink
      id="assistant"
      href={href}
      label={t("title")}
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
              onClick={() => ask(t(`empty.suggestions.${key}`))}
            >
              <Icon data-icon="inline-start" />
              {t(`empty.shortIdeas.${key}`)}
            </Button>
          </Card>
          {/* Comes up with the pointer or the keyboard; always there on a
                touch screen, which has no pointer to bring it up. */}
          <Button
            type="button"
            variant="secondary"
            size="icon-xs"
            aria-label={t("empty.closeIdea", {
              idea: t(`empty.shortIdeas.${key}`),
            })}
            className="absolute -top-2 -right-2 opacity-0 group-hover/idea:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
            onClick={() => setClosed((keys) => [...keys, key])}
          >
            <XIcon />
          </Button>
        </div>
      ))}
    >
      {/* Measured for where the opening starts. */}
      <div ref={globe} className="size-full">
        <VoiceGlobe className="size-full" />
      </div>
    </FloatingLink>
  )
}
