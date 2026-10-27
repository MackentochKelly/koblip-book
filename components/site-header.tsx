import Link from "next/link"

// The top bar of the owner-facing pages (home, login): the name on the
// left, one action on the right.
export function SiteHeader({ action }: { action?: React.ReactNode }) {
  return (
    <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Koblip Book
      </Link>
      {action}
    </header>
  )
}
