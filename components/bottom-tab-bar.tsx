"use client"

import Link from "next/link"
import { filledIcon, type Icon } from "@/components/ui/icons"

import { cn } from "@/lib/utils"

// An app area's tab bar on a phone (owner dashboard, team area): pinned to
// the bottom, clear of the Home bar, hidden on a computer where the menu
// is beside the page. `className` sets its columns.
export function BottomTabBar({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden",
        className
      )}
    >
      {children}
    </nav>
  )
}

// As in Koblip Sales' BottomTabBar, the open tab's icon is filled.
// filledIcon looks up a fixed icon, so nothing is made during render.
function tabIcon(icon: Icon, active: boolean) {
  const Shown = active ? filledIcon(icon) : icon
  return <Shown className="size-5" />
}

// One tab: its icon over its name.
export function TabBarLink({
  href,
  label,
  icon,
  active,
}: {
  href: string
  label: string
  icon: Icon
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        active && "text-foreground"
      )}
    >
      {tabIcon(icon, active)}
      <span className="max-w-full truncate">{label}</span>
    </Link>
  )
}
