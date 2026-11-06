"use client"

import {
  AccountMenu,
  type AccountMenuLink,
  type Owner,
} from "@/components/account-menu"
import { Separator } from "@/components/ui/separator"

// The end of an app area's top bar, the same in every area: the area's own
// buttons and its bell (if any) and a short line, then who is logged in, opening the
// account menu.
export function TopBarAccount({
  owner,
  settingsHref,
  links,
  children,
}: {
  owner: Owner
  settingsHref?: string
  links?: AccountMenuLink[]
  // The area's buttons and bell, before the line.
  children?: React.ReactNode
}) {
  return (
    <>
      {children && (
        <>
          <div className="flex items-center gap-2">{children}</div>
          <Separator
            orientation="vertical"
            className="data-vertical:h-5 data-vertical:self-center"
          />
        </>
      )}
      <AccountMenu owner={owner} settingsHref={settingsHref} links={links} />
    </>
  )
}
