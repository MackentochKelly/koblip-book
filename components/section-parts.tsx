"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons"
import { ViewTabs } from "@/components/view-tabs"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

export interface SectionPart<T extends string> {
  id: T
  label: string
  href: string
  icon: React.ComponentType
}

// A page made of parts, the same on the business page and in the admin
// area. On a computer: the title and a row of tabs. On a phone: the first
// part (the overview) with a list of the others under it; each part opens as
// its own screen with a way back. `notice` is one short line under the title.
export function SectionParts<T extends string>({
  title,
  parts,
  current,
  ariaLabel,
  notice,
  children,
}: {
  title: string
  // The first is the overview, the page itself.
  parts: readonly SectionPart<T>[]
  current: T
  ariaLabel: string
  notice?: React.ReactNode
  children: React.ReactNode
}) {
  const router = useRouter()
  const [overview, ...others] = parts
  const atOverview = current === overview.id
  const open = parts.find((part) => part.id === current) ?? overview

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {!atOverview && (
          <Button
            variant="ghost"
            className="-ml-2.5 w-fit md:hidden"
            nativeButton={false}
            render={<Link href={overview.href} />}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            {title}
          </Button>
        )}
        {/* A phone shows the open part's name; a computer, the page's. */}
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className={atOverview ? undefined : "max-md:hidden"}>{title}</span>
          {!atOverview && <span className="md:hidden">{open.label}</span>}
        </h1>
        {notice}
      </div>

      <ViewTabs
        variant="line"
        className="max-md:hidden"
        ariaLabel={ariaLabel}
        views={parts.map((part) => ({ id: part.id, label: part.label }))}
        value={current}
        onChange={(next) => {
          const part = parts.find((item) => item.id === next)
          if (part) router.push(part.href)
        }}
      />

      {children}

      {atOverview && (
        <nav aria-label={ariaLabel} className="md:hidden">
          <ItemGroup className="gap-3">
            {others.map((part) => (
              <Item key={part.id} variant="outline" render={<Link href={part.href} />}>
                <ItemMedia variant="icon">
                  <part.icon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{part.label}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </nav>
      )}
    </div>
  )
}
