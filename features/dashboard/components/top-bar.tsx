"use client"

import { usePathname } from "next/navigation"

import { AppTopBar } from "@/components/app-top-bar"
import { ExternalLinkIcon } from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"
import { navKeyFor } from "../navigation"
import { AccountMenu } from "./account-menu"

// The owner area's top bar: the page's name (the business name before setup
// is done), its public page and the account menu. Pinned, with a line under
// it. In the dashboard it starts with ☰, which opens the menu (whose top
// shows the name on a computer).
// Before the details are checked the page isn't live yet, so View page can be
// left out. `bell` sits beside the account menu on every screen (N-D11);
// a short line splits the bar's buttons from the account menu.
export function TopBar({
  business,
  owner,
  menu = false,
  viewPage = true,
  bell,
  className,
}: {
  business: { id: string; slug: string; name: string }
  owner: { name: string; email: string; image: string | null }
  menu?: boolean
  viewPage?: boolean
  bell?: React.ReactNode
  className?: string
}) {
  const m = useOwnerMessages().shell
  const pathname = usePathname()
  // In the dashboard the bar names the page, like an app's title bar; the
  // page's own big title then shows only on a computer.
  const key = menu
    ? navKeyFor(pathname, `/dashboard/${business.id}`)
    : undefined
  return (
    <AppTopBar
      title={key ? m.nav[key] : business.name}
      menuLabel={menu ? m.menu : undefined}
      className={className}
    >
      {/* The bar's buttons sit together, their tap areas touching, so the
          icons keep an even, close spacing on a phone. */}
      <div className="flex items-center md:gap-2">
        {/* Just the icon on a phone, so the title has room: plain, a 20 px
          icon like the bell beside it. */}
        {viewPage && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={m.viewPage}
            className="md:hidden [&_svg:not([class*='size-'])]:size-5"
            nativeButton={false}
            render={
              <a
                href={`/b/${business.slug}`}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <ExternalLinkIcon />
          </Button>
        )}
        {viewPage && (
          <Button
            variant="outline"
            size="sm"
            className="max-md:hidden"
            nativeButton={false}
            render={
              <a
                href={`/b/${business.slug}`}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            {m.viewPage}
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
        )}
        {bell}
      </div>
      <Separator
        orientation="vertical"
        className="data-vertical:h-5 data-vertical:self-center"
      />
      <AccountMenu
        owner={owner}
        settingsHref={menu ? `/dashboard/${business.id}/settings` : undefined}
      />
    </AppTopBar>
  )
}
