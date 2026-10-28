"use client"

import { SquarePenIcon } from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import type { AssistantMessages } from "../i18n"
import { useAssistantChat } from "../hooks/use-assistant-chat"
import { httpTransport } from "../utils/http-transport"
import { AssistantComposer } from "./assistant-composer"
import { MessageList } from "./message-list"

// The owner's chat page: the conversation fills the screen, the message
// box sits under it. The words stay until the owner starts a new chat.
export function AssistantChat({
  businessId,
  messages,
}: {
  businessId: string
  messages: AssistantMessages
}) {
  const chat = useAssistantChat(businessId, httpTransport)
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      {chat.items.length > 0 && (
        <div className="flex justify-end px-4 pt-2">
          <Button
            variant="ghost"
            size="lg"
            disabled={chat.busy}
            onClick={chat.reset}
          >
            <SquarePenIcon data-icon="inline-start" />
            {messages.newChat}
          </Button>
        </div>
      )}
      <MessageList
        messages={messages}
        items={chat.items}
        busy={chat.busy}
        error={chat.error}
        onSend={chat.send}
        onRetry={chat.retry}
        onAnswer={chat.answer}
      />
      <div className="p-4">
        <AssistantComposer
          businessId={businessId}
          labels={messages.composer}
          errors={messages.errors}
          busy={chat.busy}
          onSend={chat.send}
        />
      </div>
    </div>
  )
}
