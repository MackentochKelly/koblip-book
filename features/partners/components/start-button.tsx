"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"

// The invite page's one action (docs/plans/sales-connection.md, SC4): makes
// the business's page; on success `start` opens the sign-up page, else it
// says so here. Words come from the page.
export function StartButton({
  start,
  label,
  failed,
}: {
  start: () => Promise<{ ok: false }>
  label: string
  failed: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(false)
            await start()
            setError(true)
          })
        }
      >
        {pending && <Spinner data-icon="inline-start" />}
        {label}
      </Button>
      {error && <FieldError className="text-center">{failed}</FieldError>}
    </div>
  )
}
