"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/dal"

export type AdminActionResult = { ok: true } | { ok: false }

// Blocks an owner with Better Auth's admin plugin: their sessions end and
// they can't log in until unblocked. An admin can't block themselves.
export async function setOwnerBlocked(
  userId: string,
  blocked: boolean
): Promise<AdminActionResult> {
  const session = await requireAdmin()
  if (userId === session.userId) {
    return { ok: false }
  }
  const request = { headers: await headers() }
  try {
    if (blocked) {
      await auth.api.banUser({ ...request, body: { userId } })
    } else {
      await auth.api.unbanUser({ ...request, body: { userId } })
    }
  } catch {
    return { ok: false }
  }
  revalidatePath("/admin/owners")
  return { ok: true }
}
