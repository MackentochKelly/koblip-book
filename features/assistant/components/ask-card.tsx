"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUpIcon,
  CalendarDaysIcon,
  ContactIcon,
  UsersIcon,
} from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import type { PageLanguage } from "@/lib/page-language"
import { assistantMessagesFor } from "../i18n"
import { handOffQuestion } from "../utils/ask-handoff"

// Ideas a tap sends, the same words as an empty chat's.
const IDEAS = [
  { key: "today", icon: CalendarDaysIcon },
  { key: "free", icon: UsersIcon },
  { key: "book", icon: ContactIcon },
] as const

// A way into the assistant from another page (Home): a box to ask in and a
// few ideas to tap. Either opens the assistant with it as a new chat; no AI
// runs until then. On a phone only the ideas show, since the tab bar's ✦
// already opens the assistant.
export function AskCard({
  businessId,
  language,
}: {
  businessId: string
  language: PageLanguage
}) {
  const messages = assistantMessagesFor(language)
  const router = useRouter()
  const [text, setText] = useState("")
  const ask = (question: string) => {
    const clean = question.trim()
    if (!clean) return
    handOffQuestion(businessId, clean)
    router.push(`/dashboard/${businessId}/assistant`)
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        className="max-md:hidden"
        onSubmit={(event) => {
          event.preventDefault()
          ask(text)
        }}
      >
        <InputGroup>
          <InputGroupInput
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={messages.composer.placeholder}
            aria-label={messages.composer.label}
            maxLength={ASSISTANT_RULES.maxMessageChars}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="submit"
              variant="default"
              size="icon-sm"
              aria-label={messages.composer.send}
              disabled={text.trim() === ""}
            >
              <ArrowUpIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
      <div className="flex flex-wrap gap-2">
        {IDEAS.map(({ key, icon: Icon }) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            onClick={() => ask(messages.empty.suggestions[key])}
          >
            <Icon data-icon="inline-start" />
            {messages.empty.suggestions[key]}
          </Button>
        ))}
      </div>
    </div>
  )
}
