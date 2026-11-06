import "server-only"

import { runTranslationQueue } from "./queue"
import { TRANSLATION_RULES } from "./rules"

// The server's timer for translations, started once when the server starts
// (instrumentation.ts): it sends what is due, like retries and texts that
// waited for the next day. One run at a time; the next is set when one ends.

const timer = globalThis as typeof globalThis & {
  koblipTranslationTimer?: NodeJS.Timeout
}

async function check() {
  try {
    await runTranslationQueue()
  } catch (error) {
    console.error(error)
  }
  schedule()
}

function schedule() {
  timer.koblipTranslationTimer = setTimeout(
    check,
    TRANSLATION_RULES.timerSeconds * 1000
  )
  // The timer alone never keeps the process running.
  timer.koblipTranslationTimer.unref()
}

export function startTranslationTimer() {
  if (timer.koblipTranslationTimer) return
  schedule()
}
