"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { ChevronLeftIcon } from "@/components/ui/icons"
import { ViewTabs } from "@/components/view-tabs"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface SectionPart<T extends string> {
  id: T
  label: string
  href: string
  badge?: string
}

// A page made of parts, the same on the business page and in the admin
// area: the title and a row of tabs, one per part (each its own route). On a
// phone the tabs are a second header, pinned under the top bar while the
// page scrolls. `notice` is one short line under the title.
// `back` is for a screen opened from inside a part (one business in a list):
// it then leads back to that part, on a phone and a computer.
// `titleHidden`: the title is for screen readers only, so the tabs lead the
// page (Settings, whose name is already in the top bar and the menu).
export function SectionParts<T extends string>({
  title,
  titleHidden = false,
  parts,
  current,
  ariaLabel,
  notice,
  back,
  children,
}: {
  title: string
  titleHidden?: boolean
  // The first is the overview, the page itself.
  parts: readonly SectionPart<T>[]
  current: T
  ariaLabel: string
  notice?: React.ReactNode
  back?: { href: string; label: string }
  children: React.ReactNode
}) {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-6">
      {/* A hidden title leaves no box and no gap behind: its block melts
          away and the title itself is out of the page's flow. */}
      <div className={cn("flex flex-col gap-2", titleHidden && "contents")}>
        {back && (
          <Button
            variant="ghost"
            className="-ml-2.5 w-fit"
            nativeButton={false}
            render={<Link href={back.href} />}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            {back.label}
          </Button>
        )}
        <h1
          className={cn(
            "text-2xl font-semibold tracking-tight",
            titleHidden && "sr-only"
          )}
        >
          {title}
        </h1>
        {notice}
      </div>

      {/* On a phone: first, edge to edge (undoing the page's padding) and
          pinned just under the app's top bar (AppTopBar's height), with a
          little room above the tabs. */}
      <div className="max-md:sticky max-md:top-[calc(--spacing(14)+env(safe-area-inset-top))] max-md:z-20 max-md:order-first max-md:-mx-4 max-md:-mt-4 max-md:bg-background max-md:pt-2">
        <ViewTabs
          variant="line"
          listClassName="max-md:px-4"
          ariaLabel={ariaLabel}
          views={parts.map(({ id, label, badge }) => ({ id, label, badge }))}
          value={current}
          onChange={(next) => {
            const part = parts.find((item) => item.id === next)
            if (part) router.push(part.href)
          }}
        />
      </div>

      {children}

    </div>
  )
}
