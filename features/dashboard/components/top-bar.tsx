"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import { AppTopBar } from "@/components/app-top-bar"
import { ExternalLinkIcon } from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { navKeyFor } from "../navigation"
import { AccountMenu, useClientBookingsLink } from "@/components/account-menu"

// The owner area's top bar: the page's name (the business name before setup
// is done), its public page and the account menu. Pinned, with a line under
// it. In the dashboard it starts with ☰, which opens the menu (whose top
// shows the name on a computer).
// The setup screens leave View page out: before the details are checked the
// page isn't live yet, and the live screen's card has its own. `bell` sits beside the account menu on every screen (N-D11);
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
  owner: { name: string; contact: string; image: string | null }
  menu?: boolean
  viewPage?: boolean
  bell?: React.ReactNode
  className?: string
}) {
  const t = useTranslations("owner.shell")
  const pathname = usePathname()
  const bookingsLink = useClientBookingsLink()
  // In the dashboard the bar names the page, like an app's title bar; the
  // page's own big title then shows only on a computer.
  const key = menu
    ? navKeyFor(pathname, `/dashboard/${business.id}`)
    : undefined
  return (
    <AppTopBar
      title={key ? t(`nav.${key}`) : business.name}
      menuLabel={menu ? t("menu") : undefined}
      className={className}
    >
      <div className="flex items-center gap-2">
        {viewPage && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a
                href={`/b/${business.slug}`}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            {t("viewPage")}
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
        links={[bookingsLink]}
      />
    </AppTopBar>
  )
}
