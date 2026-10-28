"use client"

import { useEffect } from "react"
import Link from "next/link"
import confetti from "canvas-confetti"
import {
  ArrowRightIcon,
  ExternalLinkIcon,
  LinkIcon,
  ShareIcon,
  StoreIcon,
} from "@/components/ui/icons"
import { motion } from "motion/react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { cssColorToRgb } from "@/lib/css-color"
import { shareLink } from "@/lib/share-link"

// The confetti takes the app's own colours (the home gradient's tokens).
const CONFETTI_TOKENS = ["--primary", "--chart-1", "--hero-accent", "--chart-2"]
// The card pops in a moment after the page, with the confetti.
const POP = { type: "spring", bounce: 0.35, duration: 0.6 } as const

// After the owner saves their details: the page is live. Confetti once,
// then share it or open it (github.com/catdad/canvas-confetti).
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

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement)
    // canvas-confetti only reads hex colours.
    const colors = CONFETTI_TOKENS.map((token) => {
      const rgb = cssColorToRgb(styles.getPropertyValue(token).trim())
      const parts = rgb.match(/\d+/g) ?? []
      return `#${parts.map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`
    })
    void confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.35 },
      colors,
      // Nothing flies for people who turned motion off.
      disableForReducedMotion: true,
    })
    return () => {
      confetti.reset()
    }
  }, [])

  const share = async () => {
    const url = new URL(path, window.location.origin).toString()
    const result = await shareLink({ title: name, url })
    if (result === "copied") toast.success(t.linkCopied)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={POP}
      className="flex flex-col items-center gap-6 text-center"
    >
      <Avatar className="size-24">
        {photoUrl && <AvatarImage src={photoUrl} alt="" />}
        <AvatarFallback>
          <StoreIcon className="size-8" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t.live}
        </h1>
        <p className="text-muted-foreground">
          {category ? `${name} · ${category}` : name}
        </p>
      </div>
      <Item variant="muted" className="w-full text-left">
        <ItemMedia variant="icon">
          <LinkIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{name}</ItemTitle>
          <ItemDescription className="break-all">{path}</ItemDescription>
        </ItemContent>
      </Item>
      <div className="flex w-full flex-col gap-3">
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
      </div>
    </motion.div>
  )
}
