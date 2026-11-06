"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { PageSection } from "@/components/page-section"
import { Button } from "@/components/ui/button"
import { UserXIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { loginHref } from "@/lib/auth-links"
import type { DeleteResult } from "@/types/delete-account"

// Deleting the account, after a confirm, for any app area (owner Settings
// → Account, the client's Settings). The area passes its delete action and
// what goes with the account (`hint`, `confirmText`). A login too old to
// delete with asks to log in again and come back here.
export function DeleteAccountSection({
  contact,
  returnTo,
  deleteAccount,
  hint,
  confirmText,
  ownerError,
}: {
  // The account's email, else its phone.
  contact: string
  returnTo: string
  deleteAccount: () => Promise<DeleteResult>
  hint: string
  confirmText: string
  // Why it can't go while it owns a business (the client's Settings).
  ownerError?: string
}) {
  const settings = useTranslations("owner.settings")
  const t = useTranslations("owner.settings.account")
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const logInAgain = async () => {
    await authClient.signOut()
    router.replace(loginHref({ next: returnTo }))
    router.refresh()
  }
  const remove = () =>
    startTransition(async () => {
      const result = await deleteAccount().catch(() => null)
      if (result?.ok) {
        router.replace("/")
        router.refresh()
      } else if (result?.error === "owner" && ownerError) {
        toast.error(ownerError)
      } else if (result?.error === "login") {
        toast.error(t("loginAgain"), {
          action: { label: t("logIn"), onClick: () => void logInAgain() },
        })
      } else {
        toast.error(settings("tryAgain"))
      }
    })

  return (
    <PageSection id="account" title={t("title")}>
      <Item variant="outline">
        <ItemMedia variant="icon">
          <UserXIcon />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="max-w-full">
            <span className="truncate">{contact}</span>
          </ItemTitle>
          <ItemDescription className="break-words">{hint}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => setAsking(true)}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {t("delete")}
          </Button>
        </ItemActions>
      </Item>
      <ConfirmDialog
        open={asking}
        title={t("confirmTitle")}
        description={confirmText}
        confirm={t("delete")}
        cancel={t("cancel")}
        onConfirm={remove}
        onClose={() => setAsking(false)}
      />
    </PageSection>
  )
}
