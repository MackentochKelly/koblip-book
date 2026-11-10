"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useEffectEvent, useRef, useState } from "react"
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
import { useAssistantChat } from "../hooks/use-assistant-chat"
import { useLiveVoice } from "../hooks/use-live-voice"
import { useVoiceChoice } from "../hooks/use-voice-choice"
import type { VoiceChoice } from "../types"
import { wordsOf } from "../utils/chat-state"
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
  voiceChoice,
}: {
  businessId: string
  language: PageLanguage
  voiceChoice: VoiceChoice
}) {
  const t = useTranslations("assistant")
  const router = useRouter()
  const chat = useAssistantChat(businessId, httpTransport)
  const voice = useVoiceChoice(voiceChoice)
  // Talking live, owned here so the chat's buttons can speak into it.
  const live = useLiveVoice({
    businessId,
    busy: chat.busy,
    cardWaiting: chat.items.some(
      (item) =>
        item.role === "assistant" &&
        item.confirms.some((card) => card.state === "pending")
    ),
    send: chat.send,
    resume: chat.resume,
    stopAnswer: chat.stop,
    onCutOff: chat.cutOff,
    onWithdraw: chat.withdraw,
    onError: (error) => {
      // The voice is gone from ElevenLabs: stop and ask for another.
      if (error === "no_voice") {
        live.end()
        voice.forget()
        voice.ask()
      } else {
        toast.error(
          error === "mic_denied"
            ? t("composer.micDenied")
            : t(`errors.${error}`)
        )
      }
    },
  })
  // A talk hears and speaks in the language it started in, so when the
  // app's language changes it ends; the next talk starts all in the new one.
  const talkLanguage = useRef(language)
  const endTalk = useEffectEvent(() => {
    if (live.state !== "off") live.end()
  })
  useEffect(() => {
    if (talkLanguage.current === language) return
    talkLanguage.current = language
    endTalk()
  }, [language])
  // A tap on an answer's buttons: said into the talk while talking live
  // (the answer is spoken), sent as a typed message otherwise.
  const pick = (text: string) => {
    if (live.state !== "off") live.say(text)
    else void chat.send(text)
  }
  // A tap on a card. While talking live, what it did is said out loud and
  // the talk carries on from there, so it never just goes quiet.
  const answer = (id: string, accept: boolean) => {
    const talking = live.state !== "off"
    void chat.answer(id, accept).then((reply) => {
      if (talking && reply) {
        live.tapped(wordsOf(reply), accept ? "yes" : "no")
      }
    })
  }
  // Full screen on a phone only; on a computer it sits in the page.
  const phone = useIsMobile()
  const visible = useVisualViewport(phone)
  // On a phone the dashboard page behind stays still: with nothing to
  // scroll in an empty chat, iPhone Safari would scroll and bounce that
  // page instead, dragging this layer with it. Same lock as the full-screen
  // search (get-started); overscroll-behavior stops the bounce
  // (developer.mozilla.org/docs/Web/CSS/overscroll-behavior).
  useEffect(() => {
    if (!phone) return
    const root = document.documentElement
    root.style.overflow = "hidden"
    root.style.overscrollBehavior = "none"
    return () => {
      root.style.overflow = ""
      root.style.overscrollBehavior = ""
    }
  }, [phone])
  // Like ChatGPT: the chat, or the list of saved chats.
  const [view, setView] = useState<"chat" | "recent">("chat")
  const openChat = async (id: string) => {
    if (await chat.open(id)) setView("chat")
    else toast.error(t("recent.openFailed"))
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
      <header className="shrink-0 bg-background pt-[env(safe-area-inset-top)]">
        {/* Back | Chat · Recent | new chat, the tabs in the middle. On a
            computer the row spans the page, so new chat sits at its edge
            under the top bar's buttons, not beside the words. */}
        <div className="mx-auto grid h-14 w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 md:max-w-none md:px-4">
          <h1 className="sr-only">{t("title")}</h1>
          <Button
            type="button"
            variant="secondary"
            size="icon-lg"
            aria-label={t("back")}
            onClick={back}
            // The switcher's 44px, so the row's three pieces line up.
            className="size-11 justify-self-start md:invisible"
          >
            <ArrowLeftIcon />
          </Button>
          <ViewTabs
            views={[
              { id: "chat", label: t("views.chat") },
              { id: "recent", label: t("views.recent") },
            ]}
            value={view}
            onChange={setView}
            ariaLabel={t("views.label")}
          />
          <Button
            type="button"
            variant="secondary"
            size="icon-lg"
            aria-label={t("newChat")}
            disabled={chat.busy || (view === "chat" && chat.items.length === 0)}
            onClick={newChat}
            className="size-11 justify-self-end"
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
            onOpen={openChat}
            onNew={newChat}
          />
        ) : (
          <>
            <MessageList
              businessId={businessId}
              items={chat.items}
              busy={chat.busy}
              error={chat.error}
              onSend={pick}
              onRetry={chat.retry}
              onAnswer={answer}
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
                      onClick={() => chat.send(t(`empty.suggestions.${key}`))}
                    >
                      <Icon data-icon="inline-start" />
                      {t(`empty.suggestions.${key}`)}
                    </Button>
                  ))}
                </div>
              )}
              <AssistantComposer
                busy={chat.busy}
                stoppable={chat.stoppable}
                onSend={chat.send}
                onStop={chat.stop}
                live={live}
                voice={{ picking: voice, language }}
                startLive={chat.liveRequested}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
