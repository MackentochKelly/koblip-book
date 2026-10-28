"use client"

import { ExternalLinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"
import { cn } from "@/lib/utils"
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
}: {
  business: { slug: string; name: string }
  owner: { name: string; email: string; image: string | null }
  menu?: boolean
  viewPage?: boolean
}) {
  const m = useOwnerMessages().shell
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4">
      {menu && (
        <SidebarTrigger size="icon" aria-label={m.menu} className="-ml-2" />
      )}
      <p
        className={cn(
          "min-w-0 flex-1 truncate font-semibold",
          menu && "md:invisible"
        )}
      >
        {business.name}
      </p>
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
      <AccountMenu owner={owner} />
    </header>
  )
}
