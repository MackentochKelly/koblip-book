// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const {
  isPendingActionLive,
  peekPendingAction,
  resetPendingActionsForTests,
  storePendingAction,
  takePendingAction,
} = await import("./pending-actions")

const BASE = {
  ownerId: "u1",
  businessId: "b1",
  toolName: "cancel_booking",
  args: { bookingId: "k1" },
}

beforeEach(() => {
  resetPendingActionsForTests()
})

test("stores and takes once", () => {
  const stored = storePendingAction(BASE, 0)
  expect("id" in stored).toBe(true)
  const id = (stored as { id: string }).id
  expect(peekPendingAction(id)?.toolName).toBe("cancel_booking")
  expect(takePendingAction(id)?.id).toBe(id)
  expect(takePendingAction(id)).toBeNull()
  expect(peekPendingAction(id)).toBeNull()
})

test("expires after ten minutes", () => {
  const stored = storePendingAction(BASE, 0) as { id: string }
  const action = peekPendingAction(stored.id)!
  expect(isPendingActionLive(action, 9 * 60_000)).toBe(true)
  expect(isPendingActionLive(action, 11 * 60_000)).toBe(false)
})

test("caps pending actions per owner", () => {
  for (let i = 0; i < 10; i += 1) {
    expect("id" in storePendingAction({ ...BASE, args: { n: i } }, 0)).toBe(
      true
    )
  }
  expect(storePendingAction(BASE, 1)).toEqual({ error: "too_many" })
  // Another owner still has room.
  expect("id" in storePendingAction({ ...BASE, ownerId: "u2" }, 1)).toBe(true)
})
