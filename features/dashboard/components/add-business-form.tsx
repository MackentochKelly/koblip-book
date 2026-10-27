"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

type AddResult =
  | { ok: true; businessId: string }
  | { ok: false; error: "invalid" | "not_found" | "owned" | "failed" }

const ERRORS: Record<Exclude<AddResult, { ok: true }>["error"], string> = {
  invalid: "Paste a Google Maps link or the business name",
  not_found: "That business was not found on Google Maps",
  owned: "Someone already manages this business",
  failed: "That did not work. Please try again.",
}

// The first step for an owner: paste the business's Google Maps link and its
// page is built from Google (name, hours, photos, reviews).
export function AddBusinessForm({
  action,
}: {
  action: (link: string) => Promise<AddResult>
}) {
  const router = useRouter()
  const [link, setLink] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Add your business</CardTitle>
        <CardDescription>Paste its Google Maps link.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!link.trim()) return setError(ERRORS.invalid)
            setError("")
            startTransition(async () => {
              const result = await action(link.trim()).catch((): AddResult => ({
                ok: false,
                error: "failed",
              }))
              if (result.ok) router.push(`/dashboard/${result.businessId}`)
              else setError(ERRORS[result.error])
            })
          }}
        >
          <Field data-invalid={Boolean(error) || undefined}>
            <FieldLabel htmlFor="business-link">Google Maps link</FieldLabel>
            <Input
              id="business-link"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://maps.app.goo.gl/…"
              disabled={pending}
              aria-invalid={Boolean(error) || undefined}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {pending ? "Building your page…" : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
