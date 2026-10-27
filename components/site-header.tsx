import Link from "next/link"

import { ThemeToggle } from "@/components/theme-toggle"

// The top bar of the owner-facing pages (home, login): the name on the
// left, light/dark and one action on the right.
export function SiteHeader({ action }: { action?: React.ReactNode }) {
  return (
    <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Koblip Book
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {action}
      </div>
    </header>
  )
}
