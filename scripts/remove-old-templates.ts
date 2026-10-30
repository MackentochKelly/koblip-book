import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
// @next/env ships as CommonJS, so it loads through require even in ESM.
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")

loadEnvConfig(process.cwd())

const { db } = await import("../lib/db/index")
const { chatConnections } = await import("../lib/db/schema")
const { ChatApiError, chatApi, chatConnectionUsable } = await import(
  "../features/dashboard/api/chat-oauth"
)
const { refreshChatTemplates } = await import("../features/dashboard/api/chat-templates")

// Decision D1 in docs/plans/whatsapp-notifications.md: deletes, in every
// connected business's Koblip Chat and at Meta, the first booking templates
// (before the `_v2` names) that Meta has not approved. Approved ones are only
// listed: they cannot be waiting at Meta. Meta blocks a deleted name for
// about four weeks, which is why Book now uses the `_v2` names.
//
// Lists what it would delete; pass --delete to delete it.
const OLD_NAMES = [
  "koblip_book_booking_confirmed",
  "koblip_book_booking_reminder",
  "koblip_book_booking_changed",
  "koblip_book_booking_cancelled",
  "koblip_book_owner_new_booking",
]

type Templates = {
  data?: { _id: string; template_name: string; language: string; status?: string }[]
}
type Deleted = { data?: { deleted_from_meta?: boolean; meta_deletion_error?: string } }

const doDelete = process.argv.includes("--delete")
let deleted = 0
let failed = 0

for (const connection of await db.select().from(chatConnections)) {
  const { businessId, workspaceName } = connection
  if (!chatConnectionUsable(connection)) {
    console.log(`${workspaceName}: not usable (reconnect needed), skipped`)
    continue
  }
  let list: Templates
  try {
    list = await chatApi<Templates>(businessId, "/api/template?platform=whatsapp")
  } catch (error) {
    if (!(error instanceof ChatApiError)) throw error
    console.log(`${workspaceName}: Chat could not be reached (${error.message}), skipped`)
    failed++
    continue
  }
  const old = (list.data ?? []).filter((row) => OLD_NAMES.includes(row.template_name))
  for (const row of old) {
    const what = `${workspaceName}: ${row.template_name} (${row.language}), ${row.status ?? "unknown"}`
    if (row.status?.toLowerCase() === "approved") {
      console.log(`${what}: approved, kept`)
      continue
    }
    if (!doDelete) {
      console.log(`${what}: would delete`)
      continue
    }
    try {
      const answer = await chatApi<Deleted>(businessId, `/api/template/${encodeURIComponent(row._id)}`, {
        method: "DELETE",
        body: { delete_from_meta: true },
      })
      const atMeta = answer.data?.deleted_from_meta
      console.log(
        `${what}: deleted in Chat, ${atMeta ? "deleted at Meta" : `NOT at Meta (${answer.data?.meta_deletion_error ?? "no reason"})`}`
      )
      if (atMeta) deleted++
      else failed++
    } catch (error) {
      if (!(error instanceof ChatApiError)) throw error
      console.log(`${what}: FAILED (${error.message})`)
      failed++
    }
  }
  // Book forgets the deleted ones: those messages are back to not submitted.
  if (doDelete) await refreshChatTemplates(businessId)
}

console.log(doDelete ? `Deleted ${deleted}, failed ${failed}.` : "Nothing deleted. Run with --delete to delete.")
db.$client.close()
process.exitCode = failed ? 1 : 0
