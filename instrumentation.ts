import { PHASE_PRODUCTION_BUILD } from "next/constants"

// Runs once when the server starts (node_modules/next/dist/docs/01-app/02-guides/instrumentation.md).
export async function register() {
  // The WhatsApp booking messages' timer: Node.js only (the database), and
  // never while `next build` prerenders pages.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
    const { startNotificationTimer } = await import("@/features/dashboard/api/notification-timer")
    startNotificationTimer()
  }
}
