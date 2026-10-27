import Link from "next/link"

import { glassButtonClassName } from "@/components/glass-frame"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

// The header's buttons: plain white in light mode, glass in dark. Put it on
// an outline button passed as `action`.
export const headerButtonClassName = cn(
  glassButtonClassName,
  "bg-background hover:bg-muted"
)

// The top bar of the owner-facing pages (home, login): the name on the
// left, light/dark and one action on the right.
export function SiteHeader({ action }: { action?: React.ReactNode }) {
  return (
    <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
      <Link href="/" className="flex items-center">
        <Logo />
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle className={headerButtonClassName} />
        {action}
      </div>
    </header>
  )
}
