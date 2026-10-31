import "server-only"

import { db } from "@/lib/db"
import { notificationTimer } from "@/lib/db/schema"
import { removeOldNotifications } from "@/lib/in-app-notifications"
import { NOTIFICATION_RULES } from "@/lib/notification-rules"
import { notificationRules } from "@/lib/platform-settings"
import { runNotifications } from "./notification-sender"

// The server's timer for WhatsApp booking messages, started once when the
// server starts (instrumentation.ts). One check at a time: the next is set
// only when one ends, after the admin's current `sendEverySeconds`. Each
// check leaves its time (and error) for the admin's Overview (A2), and
// removes in-app notifications past their keep time (in-app N5).

const timer = globalThis as typeof globalThis & {
  koblipNotificationTimer?: NodeJS.Timeout
}

async function check() {
  let lastError: string | null = null
  try {
    await runNotifications()
  } catch (error) {
    console.error(error)
    lastError = (error instanceof Error ? error.message : String(error)).slice(
      0,
      200
    )
  }
  try {
    await removeOldNotifications()
  } catch (error) {
    console.error(error)
  }
  try {
    const lastRunAt = new Date().toISOString()
    await db
      .insert(notificationTimer)
      .values({ id: "timer", lastRunAt, lastError })
      .onConflictDoUpdate({
        target: notificationTimer.id,
        set: { lastRunAt, lastError },
      })
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
