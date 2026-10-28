"use client"

import Link from "next/link"
import {
  ArrowRightIcon,
  ExternalLinkIcon,
  LinkIcon,
  ShareIcon,
  StoreIcon,
} from "@/components/ui/icons"
import { toast } from "sonner"

import { Celebration } from "@/components/celebration"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { shareLink } from "@/lib/share-link"

// After the owner saves their details: the page is live (the shared
// Celebration), then share it or open it.
export function LiveCard({
  name,
  category,
  photoUrl,
  slug,
  dashboardHref,
  labels: t,
}: {
  name: string
  category: string | null
  photoUrl: string | null
  slug: string
  dashboardHref: string
  // In the owner's language, from the page.
  labels: {
    live: string
    linkCopied: string
    shareLink: string
    viewMyPage: string
    toDashboard: string
  }
}) {
  const path = `/b/${slug}`

  const share = async () => {
    const url = new URL(path, window.location.origin).toString()
    const result = await shareLink({ title: name, url })
    if (result === "copied") toast.success(t.linkCopied)
  }

  return (
    <Celebration
      media={
        <Avatar className="size-24">
          {photoUrl && <AvatarImage src={photoUrl} alt="" />}
          <AvatarFallback>
            <StoreIcon className="size-8" />
          </AvatarFallback>
        </Avatar>
      }
      title={t.live}
      description={category ? `${name} · ${category}` : name}
      actions={
        <>
          <Button size="lg" onClick={() => void share()}>
            <ShareIcon data-icon="inline-start" />
            {t.shareLink}
          </Button>
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<a href={path} target="_blank" rel="noreferrer" />}
          >
            {t.viewMyPage}
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
          <Button
            variant="link"
            nativeButton={false}
            render={<Link href={dashboardHref} />}
          >
            {t.toDashboard}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </>
      }
    >
      <Item variant="muted" className="w-full text-left">
        <ItemMedia variant="icon">
          <LinkIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{name}</ItemTitle>
          <ItemDescription className="break-all">{path}</ItemDescription>
        </ItemContent>
      </Item>
    </Celebration>
  )
}
