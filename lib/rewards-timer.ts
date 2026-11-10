import "server-only"

import { REWARD_RULES } from "./reward-rules"
import { sweepRewards } from "./rewards"

// The server's timer for rewards (docs/plans/rewards.md, RW4): counts
// bookings that ended since the last look and expires rewards past their
// date, started once when the server starts (instrumentation.ts). One
// sweep at a time: the next is set only when one ends.

const timer = globalThis as typeof globalThis & {
  koblipRewardsTimer?: NodeJS.Timeout
}

async function check() {
  try {
    await sweepRewards()
  } catch (error) {
    console.error(error)
  }
  schedule()
}

function schedule() {
  timer.koblipRewardsTimer = setTimeout(
    check,
    REWARD_RULES.sweepMinutes * 60_000
  )
  // The timer alone never keeps the process running.
  timer.koblipRewardsTimer.unref()
}

export function startRewardsTimer() {
  if (timer.koblipRewardsTimer) return
  schedule()
}
