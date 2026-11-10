"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { CheckIcon, CopyIcon } from "@/components/ui/icons"

// How long the button says it worked.
const COPIED_MS = 2000

// Copies a text shown beside it (where to send a payment): one tap, and
// the button says it worked. For a value in a box of its own, see
// CopyField. Words come from the caller's area.
export function CopyButton({
  value,
  copyLabel,
  copiedLabel,
  failedLabel,
}: {
  value: string
  copyLabel: string
  copiedLabel: string
  failedLabel: string
}) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => setCopied(true),
          () => toast.error(failedLabel)
        )
      }}
    >
      {copied ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <CopyIcon data-icon="inline-start" />
      )}
      <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
    </Button>
  )
}
