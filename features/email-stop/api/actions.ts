"use server"

import { redirect } from "next/navigation"

import { stopEmails } from "@/lib/email-stop"

// The page's "Stop emails" button. The signed link is the only key
// (lib/email-stop.ts): no sign-in, and a wrong or changed link stops
// nothing. Back on the same page, which then says it is done.
export async function stopEmailsAction(formData: FormData): Promise<void> {
  const token = formData.get("t")
  const value = typeof token === "string" ? token : ""
  const stopped = await stopEmails(value)
  redirect(`/email/stop?t=${encodeURIComponent(value)}${stopped ? "&stopped=1" : ""}`)
}
