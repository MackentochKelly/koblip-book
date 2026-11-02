"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { DraggableFloat } from "@/components/draggable-float"
import { FloatingLinkButton } from "@/components/floating-link"
import { Button } from "@/components/ui/button"
import { ChartColumnIcon, TagIcon, UserPlusIcon } from "@/components/ui/icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
// button): a round globe that floats over the page and opens the assistant.
// Pointing at it, or reaching it with the keyboard, shows a few ideas above it.
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
  const [open, setOpen] = useState(false)
  const href = `/dashboard/${businessId}/assistant`

  // Off on a phone, so its moving canvas never starts there.
  if (!desktop) return null

  const ask = (question: string) => {
    handOff(businessId, { kind: "ask", text: question })
    router.push(href)
  }

  return (
    <DraggableFloat id="assistant">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          openOnHover
          nativeButton={false}
          // Pressing it starts a tap or a drag: the ideas get out of the way.
          onPointerDown={() => setOpen(false)}
          onFocus={(event) => {
            if (event.target.matches(":focus-visible")) setOpen(true)
          }}
          render={
            // No browser tooltip on top of the ideas.
            <FloatingLinkButton
              href={href}
              label={messages.title}
              title={undefined}
              bare
            >
              <VoiceGlobe className="size-full" />
            </FloatingLinkButton>
          }
        />
        <PopoverContent
          side="top"
          align="end"
          initialFocus={false}
          className="w-auto gap-0 p-1"
        >
          {IDEAS.map(({ key, icon: Icon }) => (
            <Button
              key={key}
              type="button"
              variant="ghost"
              size="lg"
              className="justify-start font-normal text-muted-foreground"
              onClick={() => ask(messages.empty.suggestions[key])}
            >
              <Icon data-icon="inline-start" />
              {messages.empty.suggestions[key]}
            </Button>
          ))}
        </PopoverContent>
      </Popover>
    </DraggableFloat>
  )
}
