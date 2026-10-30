"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/dal"
import { saveAll } from "@/lib/db/save-all"
import { adminChangeEntry } from "@/lib/platform-settings"
import { cancelWaitingWrite, sendAgainWrite } from "@/lib/whatsapp-sends"

type Result = { ok: true } | { ok: false; error: string }

// "Send again" on any business's failed message (A5): the same rules as the
// owner's (D17), saved with its entry in the change log, together.
export async function adminSendAgain(sendId: string): Promise<Result> {
  const session = await requireAdmin()
  const again = await sendAgainWrite(String(sendId))
  if (!again.ok) return again
  await saveAll([
    again.write,
    adminChangeEntry({
      key: "whatsapp.activity.sendAgain",
      businessId: again.send.businessId,
      before: { id: again.send.id, state: again.send.state, reason: again.send.reason },
      after: { id: again.send.id, state: "pending" },
      userId: session.userId,
    }),
  ])
  revalidatePath("/admin/whatsapp/activity")
  return { ok: true }
}

// Cancels any business's waiting message (A5): kept as not sent with the
// reason `adminCancelled`, logged.
export async function adminCancelSend(sendId: string): Promise<Result> {
  const session = await requireAdmin()
  const cancel = await cancelWaitingWrite(String(sendId))
  if (!cancel.ok) return cancel
  await saveAll([
    cancel.write,
    adminChangeEntry({
      key: "whatsapp.activity.cancel",
      businessId: cancel.send.businessId,
      before: { id: cancel.send.id, state: cancel.send.state, dueAt: cancel.send.dueAt },
      after: { id: cancel.send.id, state: "skipped", reason: "adminCancelled" },
      userId: session.userId,
    }),
  ])
  revalidatePath("/admin/whatsapp/activity")
  return { ok: true }
}
