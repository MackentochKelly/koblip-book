"use client"

import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ContactIcon,
  SquarePenIcon,
  TagIcon,
  UsersIcon,
} from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { useVisualViewport } from "@/hooks/use-visual-viewport"
import type { PageLanguage } from "@/lib/page-language"
import { assistantMessagesFor } from "../i18n"
import { useAssistantChat } from "../hooks/use-assistant-chat"
import { httpTransport } from "../utils/http-transport"
import { AssistantComposer } from "./assistant-composer"
import { MessageList } from "./message-list"

// What a new chat offers to send, in this order.
const SUGGESTIONS = [
  { key: "today", icon: CalendarDaysIcon },
  { key: "free", icon: UsersIcon },
  { key: "book", icon: ContactIcon },
  { key: "services", icon: TagIcon },
] as const

// The owner's chat: a header with back and new chat, the conversation, and
// the message box at the bottom. On a phone it is a full page pinned to the
// part of the screen above the keyboard, so the box rises with it and the
// header stays in view; on a computer it fills the page beside the menu. The words stay until the owner starts a new chat.
export function AssistantChat({
  businessId,
  language,
}: {
  businessId: string
  language: PageLanguage
}) {
  const messages = assistantMessagesFor(language)
  const router = useRouter()
  const chat = useAssistantChat(businessId, httpTransport)
  // Full screen on a phone only; on a computer it sits in the page.
  const phone = useIsMobile()
  const visible = useVisualViewport(phone)

  // Back to the page the owner came from, or the dashboard when the chat
  // was opened directly.
  const back = () => {
    const cameFromHere =
      document.referrer !== "" &&
      new URL(document.referrer).origin === window.location.origin
    if (cameFromHere && window.history.length > 1) router.back()
    else router.push(`/dashboard/${businessId}`)
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-40 flex h-dvh flex-col bg-background md:static md:z-auto md:h-auto md:min-h-0 md:flex-1"
      style={visible ? { top: visible.top, height: visible.height } : undefined}
    >
      <header className="shrink-0 bg-background">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={messages.back}
            onClick={back}
            className="md:hidden"
          >
            <ArrowLeftIcon />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
            {messages.title}
          </h1>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={messages.newChat}
            disabled={chat.busy || chat.items.length === 0}
            onClick={chat.reset}
          >
            <SquarePenIcon />
          </Button>
        </div>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <MessageList
          businessId={businessId}
          messages={messages}
          items={chat.items}
          busy={chat.busy}
          error={chat.error}
          onSend={chat.send}
          onRetry={chat.retry}
          onAnswer={chat.answer}
        />
        <div className="flex flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {chat.items.length === 0 && !chat.busy && (
            <div className="flex flex-col">
              {SUGGESTIONS.map(({ key, icon: Icon }) => (
                <Button
                  key={key}
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="justify-start font-normal text-muted-foreground"
                  onClick={() => chat.send(messages.empty.suggestions[key])}
                >
                  <Icon data-icon="inline-start" />
                  {messages.empty.suggestions[key]}
                </Button>
              ))}
            </div>
          )}
          <AssistantComposer
            businessId={businessId}
            labels={messages.composer}
            errors={messages.errors}
            busy={chat.busy}
            stoppable={chat.stoppable}
            onSend={chat.send}
            onStop={chat.stop}
          />
        </div>
      </div>
    </div>
  )
}
