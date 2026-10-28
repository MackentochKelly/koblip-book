"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
}

// One group of the menu, as in Koblip Sales' NavMain (shadcn sidebar-07):
// a title, then its pages. `tooltip` names each one once the menu folds to
// icons; on a phone the menu closes once a page is picked.
export function NavMain({ title, items }: { title: string; items: NavItem[] }) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    // Folded, the titles hide; a wider gap keeps each group apart.
    <SidebarGroup className="group-data-[collapsible=icon]:py-4">
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu className="gap-1">
        {items.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              tooltip={item.label}
              isActive={item.active}
              aria-current={item.active ? "page" : undefined}
              className="text-sidebar-foreground/65 data-active:text-sidebar-accent-foreground"
              render={
                <Link
                  href={item.href}
                  onClick={() => {
                    if (isMobile) setOpenMobile(false)
                  }}
                />
              }
            >
              <item.icon strokeWidth={1.75} />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
