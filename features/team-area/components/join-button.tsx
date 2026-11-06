"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { joinTeam } from "../api/actions"

// Joins with the invite link as the signed-in account; on success the
// action opens the team area.
export function JoinButton({ token }: { token: string }) {
  const t = useTranslations("teamArea.join")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await joinTeam(token)
            setError(
              result.reason === "taken"
                ? t("taken")
                : result.reason === "already-member"
                  ? t("alreadyMember")
                  : result.reason === "expired"
                    ? t("expired.text")
                    : t("failed")
            )
          })
        }
      >
        {pending && <Spinner data-icon="inline-start" />}
        {t("join")}
      </Button>
      {error && <FieldError className="text-center">{error}</FieldError>}
    </div>
  )
}
