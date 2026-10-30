import "server-only"

import { NOTIFICATION_RULES } from "@/lib/notification-rules"
import { runNotifications } from "./notification-sender"

// The server's timer for WhatsApp booking messages, started once when the
// server starts (instrumentation.ts). One check at a time: a slow check is
// never overlapped by the next.

const timer = globalThis as typeof globalThis & { koblipNotificationTimer?: NodeJS.Timeout }

export function startNotificationTimer() {
  if (timer.koblipNotificationTimer) return
  let running = false
  timer.koblipNotificationTimer = setInterval(async () => {
    if (running) return
    running = true
    try {
      await runNotifications()
    } catch (error) {
      console.error(error)
    } finally {
      running = false
    }
  }, NOTIFICATION_RULES.sendEverySeconds * 1000)
  // The timer alone never keeps the process running.
  timer.koblipNotificationTimer.unref()
}
