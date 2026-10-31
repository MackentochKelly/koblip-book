"use client"

import { AppTopBar } from "@/components/app-top-bar"
import { ExternalLinkIcon } from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"
import { AccountMenu } from "./account-menu"

// The owner area's top bar: the business name, its public page and the
// account menu. Pinned, with a line under it. In the dashboard it starts
// with ☰, which opens the menu (whose top shows the name on a computer).
// Before the details are checked the page isn't live yet, so View page can be
// left out. `bell` sits beside the account menu on every screen (N-D11).
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
  return (
    <AppTopBar
      title={business.name}
      menuLabel={menu ? m.menu : undefined}
      className={className}
    >
      {/* Just the icon on a phone, so the business name has room. */}
      {viewPage && (
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={m.viewPage}
          className="md:hidden"
          nativeButton={false}
          render={
            <a href={`/b/${business.slug}`} target="_blank" rel="noreferrer" />
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
            <a href={`/b/${business.slug}`} target="_blank" rel="noreferrer" />
          }
        >
          {m.viewPage}
          <ExternalLinkIcon data-icon="inline-end" />
        </Button>
      )}
      {bell}
      <AccountMenu
        owner={owner}
        settingsHref={menu ? `/dashboard/${business.id}/settings` : undefined}
      />
    </AppTopBar>
  )
}
