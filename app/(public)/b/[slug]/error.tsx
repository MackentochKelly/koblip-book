"use client" // Error boundaries must be Client Components

import { useTranslations } from "next-intl"
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
  // Outside the page, so its words are the shared ones (app/layout.tsx).
  const t = useTranslations("app.pageError")
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PageNotice
      icon={<CircleAlertIcon />}
      title={t("title")}
      description={t("text")}
      action={
        <Button variant="outline" onClick={() => retry()}>
          {t("retry")}
        </Button>
      }
    />
  )
}
