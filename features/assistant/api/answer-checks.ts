import "server-only"

import type { AssistantStreamEvent } from "../types"
import { checkAnswer } from "./check-answer"

// Answer checks waiting for the screen: stored when a reply ends, run by
// POST /api/assistant/check right after, so the reply (and its time
// picker) never waits for the check. In memory is fine: the app runs as
// one process.
export interface PendingCheck {
  id: string
  ownerId: string
  businessId: string
  question: string
  toolResults: string[]
  answer: string
  label: string // the step chip's words, in the owner's language
  createdAt: number
}

// A check waits this long, and at most this many per owner.
const EXPIRES_MS = 2 * 60_000
const MAX_PER_OWNER = 10

const store = new Map<string, PendingCheck>()

export function storeAnswerCheck(
  input: Omit<PendingCheck, "id" | "createdAt">,
  now = Date.now()
): { id: string } | { error: "too_many" } {
  let kept = 0
  for (const [id, check] of store) {
    if (check.createdAt + EXPIRES_MS <= now) {
      store.delete(id)
    } else if (check.ownerId === input.ownerId) {
      kept += 1
    }
  }
  if (kept >= MAX_PER_OWNER) {
    return { error: "too_many" }
  }
  const id = crypto.randomUUID()
  store.set(id, { ...input, id, createdAt: now })
  return { id }
}

// Take for running, once. Null when unknown, expired, or someone else's
// (a foreign check stays stored for its owner).
export function takeAnswerCheck(
  id: string,
  ownerId: string,
  businessId: string,
  now = Date.now()
): PendingCheck | null {
  const check = store.get(id)
  if (!check) return null
  if (check.createdAt + EXPIRES_MS <= now) {
    store.delete(id)
    return null
  }
  if (check.ownerId !== ownerId || check.businessId !== businessId) {
    return null
  }
  store.delete(id)
  return check
}

// The check's events for the reply it belongs to: its step chip ends, and
// a notice when the answer could not be backed. Buttons never wait on it:
// they come with the answer (ask_owner).
export async function* answerCheckEvents(
  check: PendingCheck,
  signal?: AbortSignal
): AsyncGenerator<AssistantStreamEvent> {
  const verdict = await checkAnswer({
    question: check.question,
    toolResults: check.toolResults,
    answer: check.answer,
    signal,
  })
  yield {
    type: "step",
    id: check.id,
    label: check.label,
    status: verdict.ok === true ? "done" : "failed",
  }
  if (verdict.ok !== true) {
    yield { type: "notice", kind: "unverified" }
  }
  yield { type: "done" }
}

// Only for tests.
export function resetAnswerChecksForTests(): void {
  store.clear()
}
