"use client"

import { useRouter } from "next/navigation"

import { FloatingLink } from "@/components/floating-link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChartColumnIcon, TagIcon, UserPlusIcon } from "@/components/ui/icons"
import { VoiceGlobe } from "@/components/voice-globe"
import { useIsDesktop } from "@/hooks/use-is-desktop"
import type { PageLanguage } from "@/lib/page-language"
import { assistantMessagesFor } from "../i18n"
import { handOff } from "../utils/ask-handoff"

// Ideas a tap sends, none of them already on Home's Ask card.
const IDEAS = [
  { key: "services", icon: TagIcon },
  { key: "week", icon: ChartColumnIcon },
  { key: "customers", icon: UserPlusIcon },
] as const

// The way into the assistant on a computer (a phone has the tab bar's middle
// button): a round globe that floats over the page and opens the assistant,
// with a few short ideas resting next to it.
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
  const href = `/dashboard/${businessId}/assistant`

  // Off on a phone, so its moving canvas never starts there.
  if (!desktop) return null

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
      attached={
        <Card className="gap-0 p-1">
          {IDEAS.map(({ key, icon: Icon }) => (
            <Button
              key={key}
              type="button"
              variant="ghost"
              className="justify-start font-normal text-muted-foreground"
              onClick={() => ask(messages.empty.suggestions[key])}
            >
              <Icon data-icon="inline-start" />
              {messages.empty.shortIdeas[key]}
            </Button>
          ))}
        </Card>
      }
    >
      <VoiceGlobe className="size-full" />
    </FloatingLink>
  )
}
