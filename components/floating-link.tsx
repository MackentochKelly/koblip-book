"use client"

import Link from "next/link"

import { DraggableFloat } from "@/components/draggable-float"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// The round link itself, for a page that wraps it in more than DraggableFloat.
// `bare` leaves the frosted glass out, for a child that is a round thing of its
// own.
export function FloatingLinkButton({
  href,
  label,
  bare = false,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "render"> & {
  href: string
  label: string
  bare?: boolean
}) {
  return (
    <Button
      size="icon-lg"
      variant={bare ? "ghost" : "default"}
      aria-label={label}
      title={label}
      nativeButton={false}
      render={<Link href={href} draggable={false} />}
      {...props}
      className={cn(
        "size-12 rounded-full",
        bare
          ? "border-0 hover:scale-105 hover:bg-transparent dark:hover:bg-transparent"
          : "border border-foreground/25 bg-muted/70 text-foreground backdrop-blur-2xl backdrop-saturate-150 hover:bg-muted [&_svg:not([class*='size-'])]:size-6",
        className
      )}
    >
      {children}
    </Button>
  )
}

// A round frosted-glass icon that links somewhere and floats over the page,
// which people can drag out of the way (see DraggableFloat).
export function FloatingLink({
  id,
  ...link
}: React.ComponentProps<typeof FloatingLinkButton> & {
  // Names the corner this button keeps in the browser.
  id: string
}) {
  return (
    <DraggableFloat id={id}>
      <FloatingLinkButton {...link} />
    </DraggableFloat>
  )
}
