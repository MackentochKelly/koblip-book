"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  BusinessDetails,
  type BusinessDetailsData,
} from "@/components/business-details"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { confirmBusinessDetails } from "../api/actions"

// Shown on the dashboard until the owner confirms what came from Google
// Maps. Once confirmed, the details are the owner's own (Google's terms
// don't let us keep Google's copy). Saving details or hours confirms too.
export function ConfirmDetailsCard({
  businessId,
  details,
}: {
  businessId: string
  details: BusinessDetailsData
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const base = `/dashboard/${businessId}`

  const confirm = () =>
    startTransition(async () => {
      const result = await confirmBusinessDetails(businessId)
      if (result.ok) {
        toast.success("Details confirmed")
        router.refresh()
      } else {
        toast.error("Could not confirm. Try again.")
      }
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your details</CardTitle>
        <CardDescription>From Google Maps. Is this right?</CardDescription>
      </CardHeader>
      <CardContent>
        <BusinessDetails details={details} hoursHref={`${base}/hours`} />
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`${base}/settings`} />}
        >
          Edit
        </Button>
        <Button onClick={confirm} disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Looks right
        </Button>
      </CardFooter>
    </Card>
  )
}
