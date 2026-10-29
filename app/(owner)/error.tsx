"use client" // Error boundaries must be Client Components

import { useEffect } from "react"
import { CircleAlertIcon } from "@/components/ui/icons"

import { PageNotice } from "@/components/page-notice"
import { Button } from "@/components/ui/button"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"

// Any owner page (login, setup, dashboard) that fails to load: the same
// notice as the public pages, in the owner's language.
export default function Error({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  const t = useOwnerMessages().shell.error

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PageNotice
      icon={<CircleAlertIcon />}
      title={t.title}
      description={t.description}
      action={
        <Button variant="outline" onClick={() => retry()}>
          {t.retry}
        </Button>
      }
    />
  )
}
