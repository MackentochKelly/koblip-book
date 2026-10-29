"use client" // Error boundaries must be Client Components

import { useEffect } from "react"
import { CircleAlertIcon } from "@/components/ui/icons"

import { PageNotice } from "@/components/page-notice"
import { Button } from "@/components/ui/button"
import { useAdminMessages } from "@/features/admin/i18n/provider"

// An admin page that fails to load: the app's usual notice, in the admin's
// language.
export default function Error({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  const t = useAdminMessages().error

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
