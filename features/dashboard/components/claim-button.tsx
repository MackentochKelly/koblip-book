"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { claimBusiness } from "../api/actions"

// Takes over an unclaimed page, then opens its dashboard.
export function ClaimButton({ slug }: { slug: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await claimBusiness(slug)
          if (result.ok) router.push(`/dashboard/${result.businessId}`)
          else if (result.error === "owned")
            toast.error("Someone already manages this business")
          else toast.error("That did not work. Please try again.")
        })
      }
    >
      {pending && <Spinner data-icon="inline-start" />}
      Claim this business
    </Button>
  )
}
