"use client"

import { useState } from "react"
import { toast } from "sonner"

import { CheckIcon, CopyIcon } from "@/components/ui/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

// A value to copy (a key, a link): shown read-only, with a copy button at
// its end that says it worked.
export function CopyField({
  id,
  value,
  copyLabel,
  copiedLabel,
  failedLabel,
}: {
  id: string
  value: string
  copyLabel: string
  copiedLabel: string
  failedLabel: string
}) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true)
        toast.success(copiedLabel)
      },
      () => toast.error(failedLabel)
    )
  }
  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        value={value}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
        className="font-mono"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-sm"
          aria-label={copyLabel}
          onClick={copy}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
