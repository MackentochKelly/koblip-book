"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  CalendarDaysIcon,
  ClockIcon,
  ContactIcon,
  ExternalLinkIcon,
  LogOutIcon,
  ScissorsIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const NAV = [
  { path: "", label: "Bookings", icon: CalendarDaysIcon },
  { path: "/customers", label: "Customers", icon: ContactIcon },
  { path: "/services", label: "Services", icon: ScissorsIcon },
  { path: "/team", label: "Team", icon: UsersIcon },
  { path: "/hours", label: "Hours", icon: ClockIcon },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
]

// The owner area: a sidebar on a computer, a bottom tab bar on a phone, and
// a top bar with the business name, its public page and the account menu.
export function DashboardShell({
  business,
  owner,
  children,
}: {
  business: { id: string; slug: string; name: string }
  owner: { name: string; email: string }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const base = `/dashboard/${business.id}`
  const items = NAV.map((item) => ({
    ...item,
    href: base + item.path,
    active: item.path
      ? pathname.startsWith(base + item.path)
      : pathname === base,
  }))
  const signOut = async () => {
    await authClient.signOut()
    router.replace("/")
    router.refresh()
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar
          collapsible="none"
          className="sticky top-0 hidden h-dvh border-r md:flex"
        >
          <SidebarHeader>
            <p className="truncate px-2 pt-2 font-semibold">{business.name}</p>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={item.active}
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4">
            <p className="min-w-0 flex-1 truncate font-semibold md:invisible">
              {business.name}
            </p>
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
              View page
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" aria-label="Account" />
                }
              >
                <Avatar size="sm">
                  <AvatarFallback>
                    {owner.name.trim().charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate">
                    {owner.email}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut()}>
                  <LogOutIcon />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <div className="mx-auto w-full max-w-3xl p-4 pb-28 md:p-8">
            {children}
          </div>
        </SidebarInset>
        <nav
          aria-label="Owner"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                item.active && "text-foreground"
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </SidebarProvider>
    </TooltipProvider>
  )
}
