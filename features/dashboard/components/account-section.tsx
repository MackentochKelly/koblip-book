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
import { deleteAccount } from "../api/delete-actions"

// Settings → Account: the owner deletes their account and every business
// they own, after a confirm. A login too old to delete with asks them to
// log in again and come back here.
export function AccountSection({
  contact,
  returnTo,
}: {
  // The account's email, else its phone.
  contact: string
  returnTo: string
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
          <ItemDescription>{t("deleteHint")}</ItemDescription>
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
        description={t("confirmText")}
        confirm={t("delete")}
        cancel={t("cancel")}
        onConfirm={remove}
        onClose={() => setAsking(false)}
      />
    </PageSection>
  )
}
