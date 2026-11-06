"use server"

import { eq } from "drizzle-orm"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { hasFeature } from "@/lib/plan-access"
import { businesses } from "@/lib/db/schema"
import type { ActionResult } from "../types"
import { normalizeLayout } from "../utils/widget-layout"
import { WIDGETS_COOKIE_MAX_AGE, WIDGETS_COOKIE_PREFIX } from "../widgets"
import { ownedBusiness } from "./owned-business"

// Saves Home's widgets: on this device only (a cookie), or on the account
// for every device, which also drops this device's own layout.
export async function saveWidgetLayout(
  businessId: string,
  layout: unknown,
  device: boolean
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "notFound" }
  if (!(await hasFeature(businessId, "widgets"))) return { ok: false, error: "locked" }
  const clean = normalizeLayout(layout)
  const store = await cookies()
  const name = WIDGETS_COOKIE_PREFIX + businessId
  if (device) {
    store.set(name, JSON.stringify(clean), {
      maxAge: WIDGETS_COOKIE_MAX_AGE,
      path: "/dashboard",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  } else {
    store.delete({ name, path: "/dashboard" })
    await db
      .update(businesses)
      .set({ dashboardWidgets: clean })
      .where(eq(businesses.id, businessId))
  }
  revalidatePath(`/dashboard/${businessId}`, "layout")
  return { ok: true }
}
