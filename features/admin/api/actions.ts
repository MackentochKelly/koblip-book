"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { businesses, serviceCategories, services } from "@/lib/db/schema"
import { revalidateBusiness } from "@/lib/revalidate-business"

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

// Removes one service category; its services move to Other in the same
// write, never removed (docs/plans/service-categories.md). One already gone
// is done.
export async function adminDeleteServiceCategory(
  categoryId: string
): Promise<AdminActionResult> {
  await requireAdmin()
  if (typeof categoryId !== "string") {
    return { ok: false }
  }
  const [category] = await db
    .select({ id: serviceCategories.id, slug: businesses.slug })
    .from(serviceCategories)
    .innerJoin(businesses, eq(businesses.id, serviceCategories.businessId))
    .where(eq(serviceCategories.id, categoryId))
    .limit(1)
  if (category) {
    await saveAll([
      db
        .update(services)
        .set({ categoryId: null })
        .where(eq(services.categoryId, category.id)),
      db.delete(serviceCategories).where(eq(serviceCategories.id, category.id)),
    ])
    revalidateBusiness(category.slug)
  }
  revalidatePath("/admin/service-categories")
  return { ok: true }
}
