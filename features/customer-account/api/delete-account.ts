"use server"

import { eq } from "drizzle-orm"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { getCustomer } from "@/lib/customer-dal"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import { hasFreshLogin } from "@/lib/fresh-login"
import type { DeleteResult } from "@/types/delete-account"

// The client's Settings: the account and its login go; its bookings stay
// with the businesses (lib/auth.ts unlinks them). An account that owns a
// business deletes it from that business's settings, where the business
// goes with it.
export async function deleteClientAccount(): Promise<DeleteResult> {
  const customer = await getCustomer()
  if (!customer) return { ok: false, error: "failed" }
  const [owned] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.ownerId, customer.userId))
    .limit(1)
  if (owned) return { ok: false, error: "owner" }
  if (!(await hasFreshLogin())) return { ok: false, error: "login" }
  try {
    await auth.api.deleteUser({ headers: await headers(), body: {} })
  } catch {
    return { ok: false, error: "failed" }
  }
  return { ok: true }
}
