"use client"

import Link from "next/link"

import { DraggableFloat } from "@/components/draggable-float"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// A round frosted-glass icon that links somewhere and floats over the page,
// which people can drag out of the way (see DraggableFloat). `bare` leaves the
// glass out, for a child that is a round thing of its own.
export function FloatingLink({
  id,
  href,
  label,
  bare = false,
  children,
}: {
  // Names the corner this button keeps in the browser.
  id: string
  href: string
  label: string
  bare?: boolean
  children: React.ReactNode
}) {
  return (
    <DraggableFloat id={id}>
      <Button
        size="icon-lg"
        variant={bare ? "ghost" : "default"}
        aria-label={label}
        title={label}
        nativeButton={false}
        render={<Link href={href} draggable={false} />}
        className={cn(
          "size-12 rounded-full",
          bare
            ? "border-0 hover:scale-105 hover:bg-transparent dark:hover:bg-transparent"
            : "border border-foreground/25 bg-muted/70 text-foreground backdrop-blur-2xl backdrop-saturate-150 hover:bg-muted [&_svg:not([class*='size-'])]:size-6"
        )}
      >
        {children}
      </Button>
    </DraggableFloat>
  )
}
