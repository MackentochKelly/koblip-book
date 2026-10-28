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
      <ItemContent>
        <ItemTitle>{confirm.title}</ItemTitle>
        <ItemDescription>{confirm.summary}</ItemDescription>
      </ItemContent>
      <ItemActions>
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
