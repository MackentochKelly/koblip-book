"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { LogOutIcon } from "@/components/ui/icons"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"

// Ends the sign-in on this device and goes to `next`. Quiet (ghost), so the
// screen's main action stays the one that stands out.
export function SignOutButton({ next }: { next: string }) {
  const t = useTranslations("public.account")
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="ghost"
      size="lg"
      className="mx-auto flex"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await authClient.signOut()
        router.replace(next)
        router.refresh()
      }}
    >
      {busy ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <LogOutIcon data-icon="inline-start" />
      )}
      {t("signOut")}
    </Button>
  )
}
