"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// An app area's top bar (owner dashboard, admin): pinned, the page's title
// and its buttons at the end. With `menuLabel` it starts with ☰, which opens
// the area's menu; the title then hides on a computer, where the open menu
// is beside it. No line under it: like Apple's soft scroll edge effect, the
// page blurs under frosted glass that fades out below the bar.
export function AppTopBar({
  title,
  menuLabel,
  className,
  children,
}: {
  title: string
  menuLabel?: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <header
      className={cn(
        // Clear of the notch when the page runs from the Home Screen (the
        // inset is 0 elsewhere): the 56px bar sits below it.
        "sticky top-0 z-30 flex h-[calc(--spacing(14)+env(safe-area-inset-top))] items-center gap-2 px-4 pt-[env(safe-area-inset-top)]",
        // The glass: the frosted menus' blur on the bar itself (a blur on
        // a layer inside it would only see the bar), then the same colour
        // fading out just below it, so nothing is cut by a hard edge.
        "bg-background/80 backdrop-blur-2xl backdrop-saturate-150",
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-linear-to-b after:from-background/80 after:to-transparent",
        className
      )}
    >
      {menuLabel && (
        // Koblip Sales' header button: a 20 px icon, like the bar's others.
        <SidebarTrigger
          size="icon"
          aria-label={menuLabel}
          className="-ml-1 shrink-0 [&_svg:not([class*='size-'])]:size-5"
        />
      )}
      <p
        className={cn(
          "min-w-0 flex-1 truncate font-semibold",
          menuLabel && "md:invisible"
        )}
      >
        {title}
      </p>
      {children}
    </header>
  )
}
