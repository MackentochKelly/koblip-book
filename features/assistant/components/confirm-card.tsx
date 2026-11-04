import {
  AlertCircleIcon,
  CircleCheckIcon,
  SparklesIcon,
  XIcon,
} from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace"
import type { AssistantMessages } from "../i18n"
import type { ChatConfirm } from "../utils/chat-state"

// The assistant never does a risky thing alone: the owner taps first.
// AI Elements' Confirmation: an outlined row with the question and two
// buttons; once answered it folds into one line, like a finished step.
export function ConfirmCard({
  confirm,
  labels,
  disabled,
  onAnswer,
}: {
  confirm: ChatConfirm
  labels: AssistantMessages["confirm"]
  disabled: boolean
  onAnswer: (accept: boolean) => void
}) {
  if (confirm.state !== "pending") {
    const accepted = confirm.state === "accepted"
    return (
      <Trace>
        <TraceLine>
          <TraceIcon>{accepted ? <CircleCheckIcon /> : <XIcon />}</TraceIcon>
          <TraceTitle>
            {accepted ? labels.confirmed : labels.cancelled}
          </TraceTitle>
        </TraceLine>
      </Trace>
    )
  }
  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        {confirm.destructive ? <AlertCircleIcon /> : <SparklesIcon />}
      </ItemMedia>
      {/* The owner decides from these words, so they always show in full.
          Where the words and buttons don't fit side by side (a phone, the
          small chat panel), the buttons drop under them. */}
      <ItemContent className="flex-[1_1_--spacing(56)]">
        <ItemTitle className="line-clamp-none">{confirm.title}</ItemTitle>
        <ItemDescription className="line-clamp-none">
          {confirm.summary}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="ml-auto">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onAnswer(false)}
        >
          {labels.cancel}
        </Button>
        <Button
          variant={confirm.destructive ? "destructive" : "default"}
          size="sm"
          disabled={disabled}
          onClick={() => onAnswer(true)}
        >
          {confirm.action}
        </Button>
      </ItemActions>
    </Item>
  )
}
