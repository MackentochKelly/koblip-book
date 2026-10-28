import "server-only"

// Pending risky actions: stored when the model asks, run only after the
// owner's tap. In memory is fine: the app runs as one process.
export interface PendingAction {
  id: string
  ownerId: string
  businessId: string
  toolName: string
  args: unknown
  createdAt: number
}

// A card lives this long, and at most this many per owner.
const EXPIRES_MS = 10 * 60_000
const MAX_PER_OWNER = 10

const store = new Map<string, PendingAction>()

function live(action: PendingAction, now: number): boolean {
  return action.createdAt + EXPIRES_MS > now
}

export function storePendingAction(
  input: Omit<PendingAction, "id" | "createdAt">,
  now = Date.now()
): { id: string } | { error: "too_many" } {
  let kept = 0
  for (const [id, action] of store) {
    if (!live(action, now)) {
      store.delete(id)
    } else if (action.ownerId === input.ownerId) {
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

// Look without consuming.
export function peekPendingAction(id: string): PendingAction | null {
  return store.get(id) ?? null
}

export function isPendingActionLive(
  action: PendingAction,
  now = Date.now()
): boolean {
  return live(action, now)
}

// Take for running. Single use: gone whether the run succeeds or not.
export function takePendingAction(id: string): PendingAction | null {
  const action = store.get(id) ?? null
  if (action) {
    store.delete(id)
  }
  return action
}

// Only for tests.
export function resetPendingActionsForTests(): void {
  store.clear()
}
