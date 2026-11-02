"use client"

import Link from "next/link"

import { DraggableFloat } from "@/components/draggable-float"
import { Button } from "@/components/ui/button"

// A round frosted-glass icon that links somewhere and floats over the page,
// which people can drag out of the way (see DraggableFloat).
export function FloatingLink({
  id,
  href,
  label,
  className,
  children,
}: {
  // Names the corner this button keeps in the browser.
  id: string
  href: string
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <DraggableFloat id={id} className={className}>
      <Button
        size="icon-lg"
        aria-label={label}
        title={label}
        nativeButton={false}
        render={<Link href={href} draggable={false} />}
        className="size-12 rounded-full border border-foreground/25 bg-muted/70 text-foreground backdrop-blur-2xl backdrop-saturate-150 hover:bg-muted [&_svg:not([class*='size-'])]:size-6"
      >
        {children}
      </Button>
    </DraggableFloat>
  )
}
