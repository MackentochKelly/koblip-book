import "server-only"

import { auth } from "@/lib/auth"
import type { DemoPaths } from "@/lib/demo-rules"
import { createDemoCopy, findDemoCopy, type DemoCopy } from "./demo-copy"
import { mayOpenNewDemo } from "./new-demo-limit"
import { purgeOldDemos } from "./purge-demos"

export type OpenDemoResult =
  | { ok: true; paths: DemoPaths; setCookies: string[] }
  | { ok: false; error: "too_many" }

// Where each demo screen lives in the real app.
function pathsOf(copy: DemoCopy): DemoPaths {
  return {
    page: `/b/${copy.slug}`,
    dashboard: `/dashboard/${copy.id}`,
    assistant: `/dashboard/${copy.id}/assistant`,
  }
}

// The visitor's address for the new-copy limit: the last X-Forwarded-For
// entry, the one our own proxy (nginx's $proxy_add_x_forwarded_for) adds,
// since earlier entries can be typed by anyone.
function addressOf(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  return forwarded?.split(",").at(-1)?.trim() || "local"
}

// Opens the visitor's demo: signs them in as a guest when they are not
// signed in (Better Auth's anonymous plugin), finds their copy or makes a
// new one from the sample, and says where each screen is. The guest's
// session cookies come back to set on the response.
export async function openDemo(headers: Headers): Promise<OpenDemoResult> {
  let setCookies: string[] = []
  const current = await auth.api.getSession({ headers })
  let userId = current?.user.id
  if (userId) {
    const copy = await findDemoCopy(userId)
    if (copy) {
      return { ok: true, paths: pathsOf(copy), setCookies }
    }
  }
  if (!mayOpenNewDemo(addressOf(headers))) {
    return { ok: false, error: "too_many" }
  }
  if (!userId) {
    const signedIn = await auth.api.signInAnonymous({
      headers,
      returnHeaders: true,
    })
    setCookies = signedIn.headers.getSetCookie()
    userId = signedIn.response?.user.id
    if (!userId) {
      throw new Error("Guest sign-in returned no user.")
    }
  }
  await purgeOldDemos()
  const copy = await createDemoCopy(userId)
  return { ok: true, paths: pathsOf(copy), setCookies }
}
