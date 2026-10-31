"use client"

import { useRouter } from "next/navigation"
import {
  CalendarDaysIcon,
  ContactIcon,
  UsersIcon,
} from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import type { PageLanguage } from "@/lib/page-language"
import { assistantMessagesFor } from "../i18n"
import { type HandOff, handOff } from "../utils/ask-handoff"
import { AssistantComposer } from "./assistant-composer"

// Ideas a tap sends, the same words as an empty chat's.
const IDEAS = [
  { key: "today", icon: CalendarDaysIcon },
  { key: "free", icon: UsersIcon },
  { key: "book", icon: ContactIcon },
] as const

// A way into the assistant from another page (Home): a few ideas to tap and
// the assistant's own message box under them. A question, or Talk live,
// opens the assistant to carry on there as a new chat; no AI runs until then.
export function AskCard({
  businessId,
  language,
}: {
  businessId: string
  language: PageLanguage
}) {
  const messages = assistantMessagesFor(language)
  const router = useRouter()
  const open = (value: HandOff) => {
    handOff(businessId, value)
    router.push(`/dashboard/${businessId}/assistant`)
  }
  const ask = (question: string) => {
    const clean = question.trim()
    if (clean) open({ kind: "ask", text: clean })
  }

  return (
    <div className="flex flex-col gap-3">
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
      {/* Nothing is answered here, so the talking-mode handlers have no
          chat to act on: talking live opens the assistant instead. */}
      <AssistantComposer
        businessId={businessId}
        labels={messages.composer}
        errors={messages.errors}
        busy={false}
        stoppable={false}
        onSend={ask}
        onSendSpoken={async () => null}
        onStop={() => {}}
        onCutOff={() => {}}
        onWithdraw={() => {}}
        onTalkLive={() => open({ kind: "live" })}
        inline
      />
    </div>
  )
}
