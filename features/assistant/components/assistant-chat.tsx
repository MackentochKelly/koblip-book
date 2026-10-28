"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ContactIcon,
  SquarePenIcon,
  TagIcon,
  UsersIcon,
} from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import { ViewTabs } from "@/components/view-tabs"
import { useIsMobile } from "@/hooks/use-mobile"
import { useVisualViewport } from "@/hooks/use-visual-viewport"
import type { PageLanguage } from "@/lib/page-language"
import { assistantMessagesFor } from "../i18n"
import { useAssistantChat } from "../hooks/use-assistant-chat"
import { httpTransport } from "../utils/http-transport"
import { AssistantComposer } from "./assistant-composer"
import { MessageList } from "./message-list"
import { RecentChats } from "./recent-chats"

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
  // Like ChatGPT: the chat, or the list of saved chats.
  const [view, setView] = useState<"chat" | "recent">("chat")
  const openChat = async (id: string) => {
    if (await chat.open(id)) setView("chat")
    else toast.error(messages.recent.openFailed)
  }
  const newChat = () => {
    chat.reset()
    setView("chat")
  }

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
        {/* Back | Chat · Recent | new chat, the tabs in the middle. */}
        <div className="mx-auto grid h-14 w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-2">
          <h1 className="sr-only">{messages.title}</h1>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={messages.back}
            onClick={back}
            className="justify-self-start md:invisible"
          >
            <ArrowLeftIcon />
          </Button>
          <ViewTabs
            views={[
              { id: "chat", label: messages.views.chat },
              { id: "recent", label: messages.views.recent },
            ]}
            value={view}
            onChange={setView}
            ariaLabel={messages.views.label}
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={messages.newChat}
            disabled={chat.busy || (view === "chat" && chat.items.length === 0)}
            onClick={newChat}
            className="justify-self-end"
          >
            <SquarePenIcon />
          </Button>
        </div>
      </header>
      {/* Full width, so the scrollbar sits at the page's edge (like
          ChatGPT); the words and the box stay in a centered column. */}
      <div className="flex min-h-0 w-full flex-1 flex-col">
        {view === "recent" ? (
          <RecentChats
            businessId={businessId}
            language={language}
            labels={messages.recent}
            onOpen={openChat}
          />
        ) : (
          <>
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
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
          </>
        )}
      </div>
    </div>
  )
}
