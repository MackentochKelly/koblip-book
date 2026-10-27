"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ExternalLinkIcon, LinkIcon, ShareIcon } from "lucide-react"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { shareLink } from "@/lib/share-link"

// Shown once, right after a new owner gets their business: the page link,
// ready to share.
export function WelcomePanel({ slug, name }: { slug: string; name: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const open = useSearchParams().get("welcome") === "1"
  const path = `/b/${slug}`

  const close = () => router.replace(pathname, { scroll: false })

  const share = async () => {
    const url = new URL(path, window.location.origin).toString()
    const result = await shareLink({ title: name, url })
    if (result === "copied") toast.success("Link copied")
  }

  return (
    <ResponsivePanel
      open={open}
      onClose={close}
      title="Your page is ready"
      footer={
        <>
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<a href={path} target="_blank" rel="noreferrer" />}
          >
            View page
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
          <Button size="lg" onClick={() => void share()}>
            <ShareIcon data-icon="inline-start" />
            Share link
          </Button>
        </>
      }
    >
      <Item variant="muted">
        <ItemMedia variant="icon">
          <LinkIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{name}</ItemTitle>
          <ItemDescription className="break-all">{path}</ItemDescription>
        </ItemContent>
      </Item>
    </ResponsivePanel>
  )
}
