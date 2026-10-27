"use client"

import { ShareIcon } from "lucide-react"
import { toast } from "sonner"

import { useMessages } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { shareLink } from "@/lib/share-link"

// The phone's share sheet, or the link copied where there is none.
export function ShareButton({
  title,
  size = "icon",
}: {
  title: string
  size?: "icon" | "icon-sm"
}) {
  const m = useMessages()
  const share = async () => {
    const result = await shareLink({ title, url: window.location.href })
    if (result === "copied") toast.success(m.page.linkCopied)
  }
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      aria-label={m.page.share}
      title={m.page.share}
      onClick={() => void share()}
    >
      <ShareIcon />
    </Button>
  )
}
