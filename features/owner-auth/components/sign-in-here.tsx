"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import type { PageLanguage } from "@/lib/page-language"

import { AuthForm } from "./auth-form"

// The one way in (AuthForm), on a screen the person stays on: signing in
// keeps them where they are, and Google comes back to the same address.
// The booking's details step shows it (docs/plans/email.md, EM-D7).
export function SignInHere({
  phoneSignIn,
  language,
}: {
  phoneSignIn: boolean
  language: PageLanguage
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (
    <AuthForm
      next={`${pathname}?${params}`}
      onSignedIn={async () => router.refresh()}
      phoneSignIn={phoneSignIn}
      language={language}
    />
  )
}
