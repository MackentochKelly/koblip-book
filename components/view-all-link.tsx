import type { Route } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ChevronRightIcon } from "@/components/ui/icons"

// "View all ›" at the top right of a short list (a widget, Home's
// bookings), opening the page with the rest.
export function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Button
      variant="ghost"
      nativeButton={false}
      render={<Link href={href as Route} />}
    >
      {label}
      <ChevronRightIcon data-icon="inline-end" />
    </Button>
  )
}
