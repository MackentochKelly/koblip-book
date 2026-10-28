import { ExternalLinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AccountMenu } from "./account-menu"

// The owner area's top bar: the business name, its public page and the
// account menu. Pinned, with a line under it. Beside the dashboard's
// sidebar (which shows the name) the name hides on a computer.
export function TopBar({
  business,
  owner,
  besideSidebar = false,
}: {
  business: { slug: string; name: string }
  owner: { name: string; email: string; image: string | null }
  besideSidebar?: boolean
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4">
      <p
        className={cn(
          "min-w-0 flex-1 truncate font-semibold",
          besideSidebar && "md:invisible"
        )}
      >
        {business.name}
      </p>
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={
          <a href={`/b/${business.slug}`} target="_blank" rel="noreferrer" />
        }
      >
        View page
        <ExternalLinkIcon data-icon="inline-end" />
      </Button>
      <AccountMenu owner={owner} />
    </header>
  )
}
