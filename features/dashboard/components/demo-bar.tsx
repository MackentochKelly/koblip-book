"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { SparklesIcon } from "@/components/ui/icons"
import { GET_STARTED_ID } from "@/components/home-section-title"
import { useInFrame } from "@/hooks/use-in-frame"

// Over the full app for a home page demo guest (features/demo): says it is
// a demo and leads to the home page's search to start for real. Not in the
// home page's phone, which shows the app as it is.
export function DemoBar() {
  const t = useTranslations("owner.shell.demo")
  const inFrame = useInFrame()
  if (inFrame) return null
  return (
    <Alert className="mb-6">
      <SparklesIcon />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>{t("text")}</AlertDescription>
      <AlertAction>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/#${GET_STARTED_ID}`} />}
        >
          {t("action")}
        </Button>
      </AlertAction>
    </Alert>
  )
}
