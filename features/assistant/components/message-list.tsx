"use client"

import {
  AlertCircleIcon,
  CheckIcon,
  MessageCircleIcon,
  XIcon,
} from "@/components/ui/icons"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Spinner } from "@/components/ui/spinner"
import type { AssistantMessages } from "../i18n"
import type { AssistantStreamEvent } from "../types"
import type { ChatItem, ChatStep } from "../utils/chat-state"
import { ConfirmCard } from "./confirm-card"

type ErrorCode = Extract<AssistantStreamEvent, { type: "error" }>["code"]

// Nothing to retry when the message itself was the problem.
const RETRYABLE: ErrorCode[] = ["rate_limited", "unavailable"]

function StepChip({ step }: { step: ChatStep }) {
  return (
    <Badge variant="secondary">
      {step.status === "running" && <Spinner data-icon="inline-start" />}
      {step.status === "done" && <CheckIcon data-icon="inline-start" />}
      {step.status === "failed" && <XIcon data-icon="inline-start" />}
      {step.label}
    </Badge>
  )
}

// The conversation, on the stock message scroller: the owner's message
// settles near the top and the reply streams in below it.
export function MessageList({
  messages: m,
  items,
  busy,
  error,
  onSend,
  onRetry,
  onAnswer,
}: {
  messages: AssistantMessages
  items: ChatItem[]
  busy: boolean
  error: ErrorCode | null
  onSend: (text: string) => void
  onRetry: () => void
  onAnswer: (id: string, accept: boolean) => void
}) {
  const last = items.at(-1)
  const waiting =
    busy &&
    (last?.role === "owner" || (last?.role === "assistant" && !last.text))

  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-4 p-4">
            {items.length === 0 && !busy && (
              <Empty className="flex-1">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MessageCircleIcon />
                  </EmptyMedia>
                  <EmptyTitle>{m.empty.title}</EmptyTitle>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => onSend(m.empty.example)}
                  >
                    {m.empty.example}
                  </Button>
                </EmptyContent>
              </Empty>
            )}
            {items.map((item) =>
              item.role === "owner" ? (
                <MessageScrollerItem
                  key={item.id}
                  messageId={item.id}
                  scrollAnchor
                >
                  <Message align="end">
                    <MessageContent>
                      <Bubble align="end">
                        <BubbleContent className="whitespace-pre-wrap">
                          {item.text}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ) : (
                <MessageScrollerItem key={item.id} messageId={item.id}>
                  <Message>
                    <MessageContent>
                      {item.steps.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {item.steps.map((step) => (
                            <StepChip key={step.id} step={step} />
                          ))}
                        </div>
                      )}
                      {item.text && (
                        <Bubble variant="muted">
                          <BubbleContent className="whitespace-pre-wrap">
                            {item.text}
                          </BubbleContent>
                        </Bubble>
                      )}
                      {item.confirms.map((confirm) => (
                        <ConfirmCard
                          key={confirm.id}
                          confirm={confirm}
                          labels={m.confirm}
                          disabled={busy}
                          onAnswer={(accept) => onAnswer(confirm.id, accept)}
                        />
                      ))}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )
            )}
            {waiting && (
              <Spinner
                className="text-muted-foreground"
                aria-label={m.working}
              />
            )}
            {error && !busy && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertDescription>{m.errors[error]}</AlertDescription>
                {RETRYABLE.includes(error) && (
                  <Button variant="outline" size="sm" onClick={onRetry}>
                    {m.retry}
                  </Button>
                )}
              </Alert>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
