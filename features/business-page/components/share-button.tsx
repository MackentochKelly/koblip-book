"use client"

import { ShareIcon } from "lucide-react"
import { toast } from "sonner"

import { useMessages } from "@/components/language-provider"
import { Button } from "@/components/ui/button"

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
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success(m.page.linkCopied)
    } catch {
      // The visitor closed the share sheet.
    }
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
