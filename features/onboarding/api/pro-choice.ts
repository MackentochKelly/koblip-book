"use server"

import { cookies } from "next/headers"

import { PRO_CHOICE_COOKIE, PRO_CHOICE_MAX_AGE } from "../pro-choice"

// Get Pro on the home page (docs/plans/subscriptions.md, P8): every business
// starts on Free and Checkout needs the business, so the choice is kept
// while the visitor signs up and sets up; the ready page then leads to
// Settings → Plan instead of the dashboard.
export async function choosePro(): Promise<void> {
  const store = await cookies()
  store.set(PRO_CHOICE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PRO_CHOICE_MAX_AGE,
  })
}
