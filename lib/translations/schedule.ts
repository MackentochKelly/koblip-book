import "server-only"

import { after } from "next/server"
import { runTranslationQueue } from "./queue"

// After a save (a Server Function or Route Handler): once the answer has
// gone, records what changed (`prepare`, usually syncTexts) and sends the
// waiting texts to Google, so the save never waits
// (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md).
// What fails here is left for the timer (lib/translations/timer.ts).
export function translateSoon(prepare?: () => Promise<unknown>): void {
  after(async () => {
    try {
      await prepare?.()
      await runTranslationQueue()
    } catch (error) {
      console.error(error)
    }
  })
}
