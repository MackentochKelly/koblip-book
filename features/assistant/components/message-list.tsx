"use client"

import Link from "next/link"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { Streamdown } from "streamdown"
import {
  AlertCircleIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  ContactIcon,
  CopyIcon,
  RefreshIcon,
  SparklesIcon,
  TagIcon,
  UsersIcon,
} from "@/components/ui/icons"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Message, MessageContent, MessageFooter } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
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
import type { AssistantStreamEvent, ResultKind, SourceKind } from "../types"
import type {
  ChatItem,
  ChatResult,
  ChatSource,
  ChatStep,
} from "../utils/chat-state"
import { ConfirmCard } from "./confirm-card"
import { QuickChoices } from "./quick-choices"
import { TimeChoices } from "./time-choices"

type ErrorCode = Extract<AssistantStreamEvent, { type: "error" }>["code"]

// Nothing to retry when the message itself was the problem.
const RETRYABLE: ErrorCode[] = ["rate_limited", "unavailable"]

// The owner page each kind of change lives on.
const RESULT_PAGES: Record<ResultKind, string> = {
  bookings: "",
  services: "/services",
  team: "/team",
  hours: "/settings/hours",
  customers: "/customers",
  settings: "/settings",
  photos: "/settings/portfolio",
  policies: "/settings/policies",
  theme: "/settings/theme",
  spanish: "/settings/spanish",
  messages: "/automations/messages",
  timing: "/automations/timing",
  flows: "/automations/flows",
}

// What a tapped action did, in full (it names what was done and when), as a
// line that opens the page it changed.
export function ResultLine({
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
          <TraceTitle className="whitespace-normal!">{result.text}</TraceTitle>
          <TraceIcon>
            <ChevronRightIcon />
          </TraceIcon>
        </TraceLine>
      </Link>
    </Trace>
  )
}

// The same icons as the owner menu.
const SOURCE_ICONS: Record<SourceKind, typeof CalendarDaysIcon> = {
  bookings: CalendarDaysIcon,
  services: TagIcon,
  team: UsersIcon,
  customers: ContactIcon,
}

// What the answer was based on (AI Elements' Sources): one line per kind,
// each opening the page with those records. Lines only: they go in a Trace.
function SourceLines({
  sources,
  businessId,
  labels,
}: {
  sources: ChatSource[]
  businessId: string
  labels: AssistantMessages["sources"]
}) {
  return (
    <>
      {sources.map(({ kind, count }) => {
        const Icon = SOURCE_ICONS[kind]
        return (
          <Link
            key={kind}
            href={`/dashboard/${businessId}${RESULT_PAGES[kind]}`}
          >
            <TraceLine>
              <TraceIcon>
                <Icon />
              </TraceIcon>
              <TraceTitle>{labels[kind](count)}</TraceTitle>
              <TraceIcon>
                <ChevronRightIcon />
              </TraceIcon>
            </TraceLine>
          </Link>
        )
      })}
    </>
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
// it works, then it folds away; a tap opens it again. `children` (what
// the answer was based on) are more lines of the same list, under the steps.
export function WorkSteps({
  steps,
  labels,
  children,
}: {
  steps: ChatStep[]
  labels: AssistantMessages["work"]
  children?: ReactNode
}) {
  const [open, setOpen] = useState<boolean | undefined>(undefined)
  const running = steps.find((step) => step.status === "running")
  // Red only when the work ended badly: a mistake the assistant caught
  // and fixed shows its ✗ inside, but the line stays calm.
  const failed = steps.at(-1)?.status === "failed"
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
            {children}
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
            size="icon"
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

// A new question from the owner (typed or said) brings the chat back down,
// even if they had scrolled up to read; from there it follows again.
function FollowNewQuestion({ id }: { id: string | undefined }) {
  const { scrollToEnd } = useMessageScroller()
  const seen = useRef(id)
  useEffect(() => {
    if (id === seen.current) return
    seen.current = id
    scrollToEnd({ behavior: "smooth" })
  }, [id, scrollToEnd])
  return null
}

// The conversation, on the stock message scroller: it keeps the newest
// words in view as they arrive (answers, cards, talking live) until the
// owner scrolls up; the arrow brings it back down.
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
  const lastQuestion = items.findLast((item) => item.role === "owner")
  const waiting =
    busy &&
    (last?.role === "owner" || (last?.role === "assistant" && !last.text))

  return (
    <MessageScrollerProvider autoScroll>
      <FollowNewQuestion id={lastQuestion?.id} />
      <MessageScroller className="flex-1">
        {/* Fade both edges (shadcn's scroll-fade), not only the bottom:
            the stock viewport sets scroll-fade-b, so "!" lets this win
            (Tailwind's documented override) without editing components/ui. */}
        <MessageScrollerViewport className="scroll-fade! [--scroll-fade-mask:var(--scroll-fade-block)]!">
          {/* pb-12 keeps the last message clear of the bottom fade. */}
          <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-4 p-4 pb-12">
            {/* Just the question, large, like big chat apps; the
                suggestions sit above the message box. A greeting on the
                page itself, not an empty state: the owner area draws empty
                states as cards. */}
            {items.length === 0 && !busy && (
              <div className="flex flex-1 items-center justify-center p-12">
                <h2 className="text-center font-heading text-2xl font-normal tracking-tight text-balance">
                  {m.empty.title}
                </h2>
              </div>
            )}
            {items.map((item) =>
              item.role === "owner" ? (
                <MessageScrollerItem key={item.id} messageId={item.id}>
                  <Message align="end">
                    <MessageContent>
                      {/* The owner's words: a light tint of the brand colour,
                          like big chat apps. */}
                      <Bubble align="end" variant="tinted">
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
                        <WorkSteps steps={item.steps} labels={m.work}>
                          {item.sources.length > 0 && (
                            <SourceLines
                              sources={item.sources}
                              businessId={businessId}
                              labels={m.sources}
                            />
                          )}
                        </WorkSteps>
                      )}
                      {/* Like big chat apps: the answer is plain text, with
                          lists and bold drawn properly (streamdown.ai). */}
                      {item.text && (
                        <Streamdown mode="static">{item.text}</Streamdown>
                      )}
                      {/* Quick answers, only while they are still the
                          open question: a tap sends one as the reply. */}
                      {item === last && !busy && item.choices.length > 0 && (
                        <QuickChoices
                          choices={item.choices}
                          onPick={onSend}
                          moreLabel={m.choices.more}
                        />
                      )}
                      {item === last && !busy && item.times && (
                        <TimeChoices
                          times={item.times}
                          onPick={onSend}
                          locale={m.locale}
                          labels={m.times}
                        />
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
                      {/* No steps to fold them into: on their own. */}
                      {item.steps.length === 0 && item.sources.length > 0 && (
                        <Trace>
                          <SourceLines
                            sources={item.sources}
                            businessId={businessId}
                            labels={m.sources}
                          />
                        </Trace>
                      )}
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
                  <Button variant="outline" onClick={onRetry}>
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
