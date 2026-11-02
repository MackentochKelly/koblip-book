"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

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
  const href = `/dashboard/${businessId}/assistant`
  const assistantOpen = usePathname().startsWith(href)

  // Off on a phone, so its moving canvas never starts there.
  if (!desktop || assistantOpen) return null

  const ideas = IDEAS.filter(({ key }) => !closed.includes(key))

  const ask = (question: string) => {
    handOff(businessId, { kind: "ask", text: question })
    router.push(href)
  }

  return (
    <FloatingLink
      id="assistant"
      href={href}
      label={messages.title}
      bare
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
      <VoiceGlobe className="size-full" />
    </FloatingLink>
  )
}
