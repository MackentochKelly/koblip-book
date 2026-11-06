"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { useMessages } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { customerAuthClient } from "@/lib/customer-auth-client"

// Ends the customer's sign-in on this device and goes back to sign-in.
export function SignOutButton({ next }: { next: string }) {
  const m = useMessages()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="link"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await customerAuthClient.signOut()
        router.replace(next)
        router.refresh()
      }}
    >
      {m.account.signOut}
    </Button>
  )
}
