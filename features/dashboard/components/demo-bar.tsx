"use client"

import Link from "next/link"

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
import { useOwnerMessages } from "../i18n/provider"

// Over the full app for a home page demo guest (features/demo): says it is
// a demo and leads to the home page's search to start for real. Not in the
// home page's phone, which shows the app as it is.
export function DemoBar() {
  const words = useOwnerMessages().shell.demo
  const inFrame = useInFrame()
  if (inFrame) return null
  return (
    <Alert className="mb-6">
      <SparklesIcon />
      <AlertTitle>{words.title}</AlertTitle>
      <AlertDescription>{words.text}</AlertDescription>
      <AlertAction>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/#${GET_STARTED_ID}`} />}
        >
          {words.action}
        </Button>
      </AlertAction>
    </Alert>
  )
}
