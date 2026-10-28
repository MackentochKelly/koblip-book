import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AssistantMessages } from "../i18n"
import type { ChatConfirm } from "../utils/chat-state"

// The assistant never does a risky thing alone: the owner taps first.
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
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{confirm.title}</CardTitle>
        <CardDescription>{confirm.summary}</CardDescription>
      </CardHeader>
      <CardFooter className="gap-2">
        {confirm.state === "pending" ? (
          <>
            <Button
              variant="outline"
              size="lg"
              disabled={disabled}
              onClick={() => onAnswer(false)}
            >
              {labels.cancel}
            </Button>
            <Button
              variant={confirm.destructive ? "destructive" : "default"}
              size="lg"
              disabled={disabled}
              onClick={() => onAnswer(true)}
            >
              {confirm.action}
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">
            {confirm.state === "accepted" ? labels.confirmed : labels.cancelled}
          </p>
        )}
      </CardFooter>
    </Card>
  )
}
