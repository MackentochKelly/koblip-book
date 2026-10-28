"use client" // Error boundaries must be Client Components

import { useEffect } from "react"
import { CircleAlertIcon } from "@/components/ui/icons"

import { PageNotice } from "@/components/page-notice"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PageNotice
      icon={<CircleAlertIcon />}
      title="This page is not available right now"
      description="Try again in a few minutes."
      action={
        <Button variant="outline" onClick={() => retry()}>
          Try again
        </Button>
      }
    />
  )
}
