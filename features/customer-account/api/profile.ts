"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { ACCOUNT_RULES } from "@/lib/account-rules"
import { auth } from "@/lib/auth"
import { getCustomer } from "@/lib/customer-dal"
import { getSession } from "@/lib/dal"
import { MY_BOOKINGS_PATH } from "@/lib/my-bookings-links"
import { deletePhoto, savePhoto } from "@/lib/uploads"
import type { PhotoResult } from "@/types/photo"

// The client's own name and photo, through Better Auth's updateUser
// (better-auth.com/docs/concepts/users-accounts#update-user), so the
// session shows them at once. Only for the signed-in account itself.

export async function saveAccountName(name: unknown): Promise<{ ok: boolean }> {
  const customer = await getCustomer()
  if (!customer || typeof name !== "string") return { ok: false }
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > ACCOUNT_RULES.maxName) {
    return { ok: false }
  }
  await auth.api.updateUser({
    body: { name: trimmed },
    headers: await headers(),
  })
  revalidatePath(MY_BOOKINGS_PATH, "layout")
  return { ok: true }
}

export async function setAccountPhoto(
  formData: FormData
): Promise<PhotoResult<{ photoUrl: string }>> {
  const session = await getSession()
  if (!session || session.isGuest) return { ok: false, error: "not_found" }
  const saved = await savePhoto(formData.get("file") as File)
  if (!saved.ok) return { ok: false, error: saved.error }
  try {
    await auth.api.updateUser({
      body: { image: saved.url },
      headers: await headers(),
    })
  } catch (error) {
    await deletePhoto(saved.url)
    throw error
  }
  // A photo from Google isn't ours to delete; deletePhoto skips it.
  await deletePhoto(session.image)
  revalidatePath(MY_BOOKINGS_PATH, "layout")
  return { ok: true, photoUrl: saved.url }
}

export async function removeAccountPhoto(): Promise<PhotoResult> {
  const session = await getSession()
  if (!session || session.isGuest) return { ok: false, error: "not_found" }
  await auth.api.updateUser({ body: { image: null }, headers: await headers() })
  await deletePhoto(session.image)
  revalidatePath(MY_BOOKINGS_PATH, "layout")
  return { ok: true }
}
