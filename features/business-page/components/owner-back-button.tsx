"use client"

import Link from "next/link"

import { DraggableFloat } from "@/components/draggable-float"
import { useMessages } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/ui/icons"

// Shown only to the business's owner on their own public page: one round
// icon back to their dashboard, which they can drag out of the way.
export function OwnerBackButton({ businessId }: { businessId: string }) {
  const label = useMessages().page.backToDashboard
  return (
    <DraggableFloat id="owner-back">
      <Button
        size="icon-lg"
        aria-label={label}
        title={label}
        nativeButton={false}
        render={<Link href={"/dashboard/" + businessId} draggable={false} />}
        className="size-12 rounded-full border border-foreground/25 bg-muted/70 text-foreground backdrop-blur-2xl backdrop-saturate-150 hover:bg-muted [&_svg:not([class*='size-'])]:size-6"
      >
        <ArrowLeftIcon />
      </Button>
    </DraggableFloat>
  )
}
