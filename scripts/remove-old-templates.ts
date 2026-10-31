import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
// @next/env ships as CommonJS, so it loads through require even in ESM.
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

const { db } = await import("../lib/db/index")
const { removeOldChatTemplates } = await import("../features/dashboard/api/chat-templates")

// Decision D1 in docs/plans/whatsapp-notifications.md: deletes, in every
// connected business's Koblip Chat and at Meta, the first booking templates
// (before the `_v2` names) that Meta has not approved (removeOldChatTemplates).
// Meta blocks a deleted name for about four weeks, which is why Book now uses
// the `_v2` names.
//
// Lists what it would delete; pass --delete to delete it.
const OLD_NAMES = [
  "koblip_book_booking_confirmed",
  "koblip_book_booking_reminder",
  "koblip_book_booking_changed",
  "koblip_book_booking_cancelled",
  "koblip_book_owner_new_booking",
]

const remove = process.argv.includes("--delete")
const { deleted, failed } = await removeOldChatTemplates({
  names: OLD_NAMES,
  remove,
  log: (line) => console.log(line),
})

console.log(remove ? `Deleted ${deleted}, failed ${failed}.` : "Nothing deleted. Run with --delete to delete.")
db.$client.close()
process.exitCode = failed ? 1 : 0
