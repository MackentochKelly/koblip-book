import { PHASE_PRODUCTION_BUILD } from "next/constants"

// Runs once when the server starts (node_modules/next/dist/docs/01-app/02-guides/instrumentation.md).
export async function register() {
  // The WhatsApp booking messages', Google Calendar's and translations'
  // timers: Node.js only (the database), and never while `next build`
  // prerenders pages.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
    // The English words first: the timers below write in them outside a
    // page.
    const [{ default: messages }, { registerEnglishWords }] = await Promise.all([
      import("@/i18n/messages"),
      import("@/lib/translations/interface-words"),
    ])
    registerEnglishWords(messages)
    const { startNotificationTimer } = await import("@/features/dashboard/api/notification-timer")
    startNotificationTimer()
    const { startGoogleCalendarTimer } = await import("@/features/dashboard/api/google-calendar-timer")
    startGoogleCalendarTimer()
    // Payment pictures are deleted when due (docs/plans/payment-proof.md).
    const { startPaymentProofTimer } = await import("@/lib/payment-proof-timer")
    startPaymentProofTimer()
    // Ended bookings are counted for rewards (docs/plans/rewards.md).
    const { startRewardsTimer } = await import("@/lib/rewards-timer")
    startRewardsTimer()
    // New and changed English goes to the database for translation
    // (docs/plans/translations.md, G4) before the translation timer's first
    // run. A database error leaves the words as they are; the next start
    // tries again.
    const { syncInterfaceWords } = await import("@/i18n/sync")
    try {
      await syncInterfaceWords()
    } catch (error) {
      console.error("Couldn't sync the app's words", error)
    }
    const { startTranslationTimer } = await import("@/lib/translations/timer")
    startTranslationTimer()
  }
}
