import "server-only"

import { sweepPaymentProofs } from "./payment-proof-cleanup"
import { PAYMENT_RULES } from "./payment-rules"

// The server's timer that deletes payment pictures when they are due
// (./payment-proof-cleanup), started once when the server starts
// (instrumentation.ts). One sweep at a time: the next is set only when one
// ends.

const timer = globalThis as typeof globalThis & {
  koblipPaymentProofTimer?: NodeJS.Timeout
}

async function check() {
  try {
    await sweepPaymentProofs()
  } catch (error) {
    console.error(error)
  }
  schedule()
}

function schedule() {
  timer.koblipPaymentProofTimer = setTimeout(
    check,
    PAYMENT_RULES.proofSweepMinutes * 60_000
  )
  // The timer alone never keeps the process running.
  timer.koblipPaymentProofTimer.unref()
}

export function startPaymentProofTimer() {
  if (timer.koblipPaymentProofTimer) return
  schedule()
}
