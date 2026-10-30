import "server-only"

import { NOTIFICATION_RULES } from "@/lib/notification-rules"
import { notificationRules } from "@/lib/platform-settings"
import { runNotifications } from "./notification-sender"

// The server's timer for WhatsApp booking messages, started once when the
// server starts (instrumentation.ts). One check at a time: the next is set
// only when one ends, after the admin's current `sendEverySeconds`.

const timer = globalThis as typeof globalThis & { koblipNotificationTimer?: NodeJS.Timeout }

async function check() {
  try {
    await runNotifications()
  } catch (error) {
    console.error(error)
  }
  let seconds: number
  try {
    seconds = (await notificationRules()).sendEverySeconds
  } catch (error) {
    console.error(error)
    seconds = NOTIFICATION_RULES.sendEverySeconds
  }
  schedule(seconds)
}

function schedule(seconds: number) {
  timer.koblipNotificationTimer = setTimeout(check, seconds * 1000)
  // The timer alone never keeps the process running.
  timer.koblipNotificationTimer.unref()
}

export function startNotificationTimer() {
  if (timer.koblipNotificationTimer) return
  schedule(NOTIFICATION_RULES.sendEverySeconds)
}
