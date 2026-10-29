import Link from "next/link"

import { glassButtonClassName } from "@/components/glass-frame"
import { Logo } from "@/components/logo"
import { StickyHeaderItem } from "@/components/sticky-header"
import { ThemeToggle } from "@/components/theme-toggle"
import { TOUCH_AREA } from "@/lib/touch-area"
import { cn } from "@/lib/utils"

// The header's buttons: plain white in light mode, glass in dark. Put it on
// an outline button passed as `action`.
export const headerButtonClassName = cn(
  glassButtonClassName,
  "bg-background hover:bg-muted"
)

// The top bar of the owner-facing pages (home, login): the name on the
// left, one small button and one action on the right. The small button is
// light/dark unless the page passes another (the home page: language).
// `floating`: the header sits in a StickyHeader (public pages). Its edge
// then lines up with the page's sections, and both ends slide when it
// turns into the pill.
export function SiteHeader({
  control = <ThemeToggle className={headerButtonClassName} />,
  action,
  floating = false,
}: {
  control?: React.ReactNode
  action?: React.ReactNode
  floating?: boolean
}) {
  const logo = (
    <Link href="/" className={cn(TOUCH_AREA, "flex items-center")}>
      <Logo />
    </Link>
  )
  const actions = (
    <div className="flex items-center gap-2">
      {control}
      {action}
    </div>
  )
  return (
    <header
      className={cn(
        "mx-auto flex h-16 w-full max-w-page items-center justify-between px-4",
        floating && "sm:px-6"
      )}
    >
      {floating ? <StickyHeaderItem>{logo}</StickyHeaderItem> : logo}
      {floating ? <StickyHeaderItem>{actions}</StickyHeaderItem> : actions}
    </header>
  )
}
