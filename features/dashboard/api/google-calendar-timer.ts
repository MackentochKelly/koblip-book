import "server-only"

import { GOOGLE_CALENDAR_RULES } from "@/lib/google-calendar-rules"
import { syncGoogleCalendars } from "@/lib/google-calendar-sync"

// The server's timer for Google Calendar (G2), started once when the server
// starts (instrumentation.ts). One sync at a time: the next is set only when
// one ends. Each connection keeps its own last sync and error.

const timer = globalThis as typeof globalThis & {
  koblipGoogleCalendarTimer?: NodeJS.Timeout
}

async function check() {
  try {
    await syncGoogleCalendars()
  } catch (error) {
    console.error(error)
  }
  schedule()
}

function schedule() {
  timer.koblipGoogleCalendarTimer = setTimeout(check, GOOGLE_CALENDAR_RULES.syncEverySeconds * 1000)
  // The timer alone never keeps the process running.
  timer.koblipGoogleCalendarTimer.unref()
}

export function startGoogleCalendarTimer() {
  if (timer.koblipGoogleCalendarTimer) return
  schedule()
}
