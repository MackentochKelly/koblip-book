"use client"

import Link from "next/link"
import { useState } from "react"
import { Streamdown } from "streamdown"
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CopyIcon,
  RefreshIcon,
  SparklesIcon,
} from "@/components/ui/icons"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Message, MessageContent, MessageFooter } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Spinner } from "@/components/ui/spinner"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { AssistantMessages } from "../i18n"
import type { AssistantStreamEvent, ResultKind } from "../types"
import type { ChatItem, ChatResult, ChatStep } from "../utils/chat-state"
import { ConfirmCard } from "./confirm-card"

type ErrorCode = Extract<AssistantStreamEvent, { type: "error" }>["code"]

// Nothing to retry when the message itself was the problem.
const RETRYABLE: ErrorCode[] = ["rate_limited", "unavailable"]

// The owner page each kind of change lives on.
const RESULT_PAGES: Record<ResultKind, string> = {
  bookings: "",
  services: "/services",
  team: "/team",
  hours: "/hours",
  customers: "/customers",
}

// What a tapped action did, as one line that opens the page it changed.
function ResultLine({
  result,
  businessId,
}: {
  result: ChatResult
  businessId: string
}) {
  return (
    <Trace>
      <Link href={`/dashboard/${businessId}${RESULT_PAGES[result.kind]}`}>
        <TraceLine status={result.ok ? undefined : "error"}>
          <TraceIcon>
            {result.ok ? <CircleCheckIcon /> : <AlertCircleIcon />}
          </TraceIcon>
          <TraceTitle>{result.text}</TraceTitle>
          <TraceIcon>
            <ChevronRightIcon />
          </TraceIcon>
        </TraceLine>
      </Link>
    </Trace>
  )
}

// One icon per step: working, done or failed.
function StepIcon({ status }: { status: ChatStep["status"] }) {
  if (status === "running") return <Spinner />
  if (status === "failed") return <AlertCircleIcon />
  return <CircleCheckIcon />
}

// What the assistant did, as one line (AI Elements' Chain of Thought):
// the step it is on while it works, "Checked 3 things" after. Open while
// it works, then it folds away; a tap opens it again.
function WorkSteps({
  steps,
  labels,
}: {
  steps: ChatStep[]
  labels: AssistantMessages["work"]
}) {
  const [open, setOpen] = useState<boolean | undefined>(undefined)
  const running = steps.find((step) => step.status === "running")
  const failed = steps.some((step) => step.status === "failed")
  const summaryStatus = running ? "running" : failed ? "error" : undefined
  return (
    <Trace>
      <TraceCollapsible open={open ?? Boolean(running)} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger>
          <TraceLine status={summaryStatus}>
            <TraceIcon>
              <SparklesIcon />
            </TraceIcon>
            <TraceTitle>
              {running ? running.label : labels.done(steps.length)}
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent keepMounted>
          <Trace>
            {steps.map((step) => (
              <TraceLine
                key={step.id}
                status={
                  step.status === "running"
                    ? "running"
                    : step.status === "failed"
                      ? "error"
                      : undefined
                }
              >
                <TraceIcon>
                  <StepIcon status={step.status} />
                </TraceIcon>
                <TraceTitle>{step.label}</TraceTitle>
              </TraceLine>
            ))}
          </Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}

// A ghost icon button with its label as a tooltip, under an answer.
function AnswerAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// Copies the answer, then shows a check for two seconds.
function CopyAnswer({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <AnswerAction
      label={label}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </AnswerAction>
  )
}

// The conversation, on the stock message scroller: the owner's message
// settles near the top and the reply streams in below it.
export function MessageList({
  businessId,
  messages: m,
  items,
  busy,
  error,
  onSend,
  onRetry,
  onAnswer,
}: {
  businessId: string
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
          {/* pb-12 keeps the last message clear of the bottom fade. */}
          <MessageScrollerContent className="gap-4 p-4 pb-12">
            {/* Just the question, large, like big chat apps; the
                suggestions sit above the message box. */}
            {items.length === 0 && !busy && (
              <Empty className="flex-1">
                <EmptyHeader>
                  <EmptyTitle className="text-2xl font-normal">
                    {m.empty.title}
                  </EmptyTitle>
                </EmptyHeader>
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
                        <WorkSteps steps={item.steps} labels={m.work} />
                      )}
                      {/* Like big chat apps: the answer is plain text, with
                          lists and bold drawn properly (streamdown.ai). */}
                      {item.text && (
                        <Streamdown mode="static">{item.text}</Streamdown>
                      )}
                      {/* Quick answers, only while they are still the
                          open question: a tap sends one as the reply. */}
                      {item === last && !busy && item.choices.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {item.choices.map((choice) => (
                            <Button
                              key={choice}
                              variant="outline"
                              onClick={() => onSend(choice)}
                            >
                              {choice}
                            </Button>
                          ))}
                        </div>
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
                      {item.result && (
                        <ResultLine
                          result={item.result}
                          businessId={businessId}
                        />
                      )}
                      {/* Under the answer, as in AI Elements' Message. */}
                      {item.text && !(item === last && busy) && (
                        <MessageFooter className="px-0">
                          <CopyAnswer text={item.text} label={m.actions.copy} />
                          {item === last && (
                            <AnswerAction
                              label={m.actions.retry}
                              onClick={onRetry}
                            >
                              <RefreshIcon />
                            </AnswerAction>
                          )}
                        </MessageFooter>
                      )}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )
            )}
            {waiting && (
              <p className="shimmer text-muted-foreground">{m.working}</p>
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
