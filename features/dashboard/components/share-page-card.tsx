"use client"

import { ExternalLinkIcon, LinkIcon, ShareIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { shareLink } from "@/lib/share-link"
import { useOwnerMessages } from "../i18n/provider"

// The Share your page widget: the booking page's link, ready to open or
// share.
export function SharePageCard({ slug, name }: { slug: string; name: string }) {
  const m = useOwnerMessages()
  const t = m.settings.share
  const path = `/b/${slug}`

  const share = async () => {
    const url = new URL(path, window.location.origin).toString()
    const result = await shareLink({ title: name, url })
    if (result === "copied") toast.success(t.linkCopied)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.widgets.names.share}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Item variant="muted">
          <ItemMedia variant="icon">
            <LinkIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{name}</ItemTitle>
            <ItemDescription className="break-all">{path}</ItemDescription>
          </ItemContent>
        </Item>
        <div className="flex flex-col gap-2 md:flex-row">
          <Button onClick={() => void share()}>
            <ShareIcon data-icon="inline-start" />
            {t.shareLink}
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={path} target="_blank" rel="noreferrer" />}
          >
            {t.viewPage}
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
