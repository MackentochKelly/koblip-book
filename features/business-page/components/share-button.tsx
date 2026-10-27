"use client"

import { ShareIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

// The phone's share sheet, or the link copied where there is none.
export function ShareButton({
  title,
  size = "icon",
}: {
  title: string
  size?: "icon" | "icon-sm"
}) {
  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success("Link copied")
    } catch {
      // The visitor closed the share sheet.
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      aria-label="Share"
      title="Share"
      onClick={() => void share()}
    >
      <ShareIcon />
    </Button>
  )
}
