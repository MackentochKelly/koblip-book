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
// left out.
export function TopBar({
  business,
  owner,
  menu = false,
  viewPage = true,
  className,
}: {
  business: { id: string; slug: string; name: string }
  owner: { name: string; email: string; image: string | null }
  menu?: boolean
  viewPage?: boolean
  className?: string
}) {
  const m = useOwnerMessages().shell
  return (
    <AppTopBar
      title={business.name}
      menuLabel={menu ? m.menu : undefined}
      className={className}
    >
      {viewPage && (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a href={`/b/${business.slug}`} target="_blank" rel="noreferrer" />
          }
        >
          {m.viewPage}
          <ExternalLinkIcon data-icon="inline-end" />
        </Button>
      )}
      <AccountMenu
        owner={owner}
        settingsHref={menu ? `/dashboard/${business.id}/settings` : undefined}
      />
    </AppTopBar>
  )
}
