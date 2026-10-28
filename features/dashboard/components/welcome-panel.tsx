"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ExternalLinkIcon, LinkIcon, ShareIcon } from "@/components/ui/icons"
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
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"
import { shareLink } from "@/lib/share-link"

// Shown once, right after a new owner gets their business: the page link,
// ready to share.
export function WelcomePanel({ slug, name }: { slug: string; name: string }) {
  const m = useOwnerMessages()
  const t = m.settings.share
  const router = useRouter()
  const pathname = usePathname()
  const open = useSearchParams().get("welcome") === "1"
  const path = `/b/${slug}`

  const close = () => router.replace(pathname, { scroll: false })

  const share = async () => {
    const url = new URL(path, window.location.origin).toString()
    const result = await shareLink({ title: name, url })
    if (result === "copied") toast.success(t.linkCopied)
  }

  return (
    <ResponsivePanel
      open={open}
      onClose={close}
      title={t.ready}
      footer={
        <>
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<a href={path} target="_blank" rel="noreferrer" />}
          >
            {t.viewPage}
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
          <Button size="lg" onClick={() => void share()}>
            <ShareIcon data-icon="inline-start" />
            {t.shareLink}
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
