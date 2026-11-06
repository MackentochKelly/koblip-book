"use client"

import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { ShareIcon } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import { shareLink } from "@/lib/share-link"

// The phone's share sheet, or the link copied where there is none.
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations("public.page")
  const share = async () => {
    const result = await shareLink({ title, url: window.location.href })
    if (result === "copied") toast.success(t("linkCopied"))
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={t("share")}
      title={t("share")}
      onClick={() => void share()}
    >
      <ShareIcon />
    </Button>
  )
}
