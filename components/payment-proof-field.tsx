"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription } from "@/components/ui/field"
import { ImageIcon } from "@/components/ui/icons"
import { Input } from "@/components/ui/input"
import { UPLOAD_RULES } from "@/lib/upload-rules"

const ACCEPT = Object.keys(UPLOAD_RULES.types).join(",")

// Picks the payment proof (docs/plans/payment-proof.md): a button that
// opens the phone's photos or camera, a small look at what was picked, and
// one line under it. The file stays with the caller, which sends it. Words
// come from the caller's area.
export function PaymentProofField({
  value,
  onChange,
  disabled,
  addLabel,
  replaceLabel,
  hint,
}: {
  value: File | null
  onChange: (file: File) => void
  disabled?: boolean
  // "Add payment proof" and, once one is picked, "Replace".
  addLabel: string
  replaceLabel: string
  hint: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!value) return
    const url = URL.createObjectURL(value)
    // The look follows the picked file, and its address is given back.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- an object URL exists only in the browser, after the file is picked
    setPreview(url)
    return () => {
      URL.revokeObjectURL(url)
      setPreview(null)
    }
  }, [value])
  return (
    <Field>
      <Input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) onChange(file)
        }}
      />
      <div className="flex items-center gap-3">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- the file just picked, still only in this browser
          <img src={preview} alt="" className="size-11 rounded-md object-cover" />
        )}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 md:min-h-9"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          <ImageIcon data-icon="inline-start" />
          {value ? replaceLabel : addLabel}
        </Button>
      </div>
      <FieldDescription>{hint}</FieldDescription>
    </Field>
  )
}
