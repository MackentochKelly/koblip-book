"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  CalendarDaysIcon,
  ContactIcon,
  UsersIcon,
} from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
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
export function AskCard({ businessId }: { businessId: string }) {
  const t = useTranslations("assistant.empty.suggestions")
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
            onClick={() => ask(t(key))}
          >
            <Icon data-icon="inline-start" />
            {t(key)}
          </Button>
        ))}
      </div>
      {/* Nothing is answered here, so the talking-mode handlers have no
          chat to act on: talking live opens the assistant instead. */}
      <AssistantComposer
        busy={false}
        stoppable={false}
        onSend={ask}
        onStop={() => {}}
        onTalkLive={() => open({ kind: "live" })}
      />
    </div>
  )
}
