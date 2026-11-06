import "server-only"

import type { AssistantStreamEvent, AssistantTool, ServerWords } from "../types"
import { logAssistantAction } from "./audit-log"
import type { PendingAction } from "./pending-actions"

// Runs a card the owner said yes to (a tap, or a clear yes in words) once
// it is taken: a step chip, the change, an audit row and the result. Only
// the stored args run. The card is already taken, so a throw still ends
// with a result: the change may have happened, so the owner is told to
// check.
export async function* runPending(
  pending: PendingAction,
  tool: AssistantTool | undefined,
  t: ServerWords
): AsyncGenerator<AssistantStreamEvent> {
  const stepId = pending.id.slice(0, 64)
  yield {
    type: "step",
    id: stepId,
    label: tool?.label ?? t("steps.working"),
    status: "running",
  }
  let outcome: { ok: boolean; doneText: string }
  try {
    outcome = tool?.confirm
      ? await tool.confirm.execute(pending.args)
      : { ok: false, doneText: t("confirm.unavailable") }
  } catch {
    console.error("assistant-confirm-failed")
    outcome = { ok: false, doneText: t("confirm.unknown") }
  }
  await logAssistantAction({
    businessId: pending.businessId,
    ownerId: pending.ownerId,
    tool: pending.toolName,
    summary: outcome.doneText,
    status: outcome.ok ? "ok" : "failed",
  })
  yield {
    type: "step",
    id: stepId,
    label: outcome.ok
      ? (tool?.doneLabel ?? t("stepsDone.working"))
      : (tool?.label ?? t("steps.working")),
    status: outcome.ok ? "done" : "failed",
  }
  yield {
    type: "result",
    ok: outcome.ok,
    text: outcome.doneText,
    kind: tool?.definition.resultKind ?? "bookings",
  }
}
