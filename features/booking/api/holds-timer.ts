import "server-only"

import { ONLINE_PAY_RULES } from "@/lib/payment-rules"
import { deleteExpiredHolds } from "./holds"

// The server's timer for held times (docs/plans/online-payments.md, ON7):
// deletes the holds nobody paid for, started once when the server starts
// (instrumentation.ts). A hold past its time already counts as free
// (heldTimes), so this only tidies up. One sweep at a time.

const timer = globalThis as typeof globalThis & {
  koblipHoldsTimer?: NodeJS.Timeout
}

async function check() {
  try {
    await deleteExpiredHolds()
  } catch (error) {
    console.error(error)
  }
  schedule()
}

function schedule() {
  timer.koblipHoldsTimer = setTimeout(
    check,
    ONLINE_PAY_RULES.holdSweepMinutes * 60_000
  )
  // The timer alone never keeps the process running.
  timer.koblipHoldsTimer.unref()
}

export function startHoldsTimer() {
  if (timer.koblipHoldsTimer) return
  schedule()
}
