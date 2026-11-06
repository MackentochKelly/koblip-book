"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { requireAccount, requireAdmin } from "@/lib/dal"
import { hasFreshLogin } from "@/lib/fresh-login"
import { deleteBusinesses, ownedBusinessIds } from "./delete-businesses"

import type { DeleteResult } from "@/types/delete-account"

// Settings → Account: the owner deletes their account, with every business
// they own. Needs a recent login (ACCOUNT_RULES.freshLoginHours), checked
// before anything goes, so nothing is half deleted; older, they log in again.
export async function deleteAccount(): Promise<DeleteResult> {
  const owner = await requireAccount()
  if (!(await hasFreshLogin())) return { ok: false, error: "login" }
  const request = { headers: await headers() }
  try {
    await deleteBusinesses(await ownedBusinessIds(owner.userId))
    await auth.api.deleteUser({ ...request, body: {} })
  } catch {
    return { ok: false, error: "failed" }
  }
  return { ok: true }
}

// The admin area's delete actions; its pages pass them in, since they live
// with the business data. An admin can't delete their own account here.

// Admin → Businesses: one business with everything in it.
export async function adminDeleteBusiness(businessId: string): Promise<DeleteResult> {
  await requireAdmin()
  if (typeof businessId !== "string") return { ok: false, error: "failed" }
  try {
    await deleteBusinesses([businessId])
  } catch {
    return { ok: false, error: "failed" }
  }
  revalidatePath("/admin", "layout")
  return { ok: true }
}

// Admin → Owners: one account with every business it owns (Better Auth's
// admin plugin removes the account and its sessions).
export async function adminDeleteUser(userId: string): Promise<DeleteResult> {
  const session = await requireAdmin()
  if (typeof userId !== "string" || userId === session.userId) {
    return { ok: false, error: "failed" }
  }
  try {
    await deleteBusinesses(await ownedBusinessIds(userId))
    await auth.api.removeUser({ headers: await headers(), body: { userId } })
  } catch {
    return { ok: false, error: "failed" }
  }
  revalidatePath("/admin", "layout")
  return { ok: true }
}
