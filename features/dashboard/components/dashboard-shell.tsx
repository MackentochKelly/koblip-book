"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import {
  AudioLinesIcon,
  CalendarDaysIcon,
  LayoutDashboardIcon,
  PlusIcon,
  TagIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/ui/icons"

import { AppInset } from "@/components/app-inset"
import { BottomTabBar, TabBarLink } from "@/components/bottom-tab-bar"
import { PageContent } from "@/components/page-content"
import { PhotoWordsProvider } from "@/components/photo-upload"
import { SpinSwap } from "@/components/spin-swap"
import { Button } from "@/components/ui/button"
import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { VoiceGlobe } from "@/components/voice-globe"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"
import { UPLOAD_RULES } from "@/lib/upload-rules"
import { cn } from "@/lib/utils"
import {
  LAST_BUSINESS_COOKIE,
  LAST_BUSINESS_MAX_AGE,
} from "../last-business"
import type { OwnedBusiness } from "../types"
import { AppSidebar } from "./app-sidebar"
import { CommandMenuProvider } from "./command-menu"
import { type TabBarAction, TabBarActionContext } from "./tab-bar-action"
import { TopBar } from "./top-bar"

const NAV = [
  { path: "", key: "home", icon: LayoutDashboardIcon },
  { path: "/bookings", key: "bookings", icon: CalendarDaysIcon },
  { path: "/services", key: "services", icon: TagIcon },
  { path: "/team", key: "team", icon: UsersIcon },
  { path: "/settings", key: "settings", icon: SettingsIcon },
] as const

// The phone has room for four tabs with the assistant between them (a +
// instead on a page that adds something, see tab-bar-action.tsx);
// Customers and Settings (with Hours) open from the ☰ menu (Settings also
// from the account menu).
const PHONE_LEFT = ["", "/bookings"]
const PHONE_RIGHT = ["/services", "/team"]

// A page's + in the tab bar's middle: a 44 px circle inside the app's
// hairline (a little darker than the cards' edge), with a 2 px gap.
const ADD_BUTTON =
  "size-11 rounded-full border-(length:--hairline) border-foreground/20 p-0.5 hover:bg-transparent dark:hover:bg-transparent"

// Pages whose middle button is + rather than the assistant. Known from the
// address, so it is + from the first moment, while the page still loads;
// the page then gives what a tap does (useTabBarAction).
const ADD_PAGES = ["/customers", "/services", "/team"]

// The owner area: the ☰ menu (folding on a computer, sliding in on a phone),
// a bottom tab bar on a phone for the main pages, and a top bar with the
// business name, its public page and the account menu. `bell` is the
// notifications bell, in the top bar beside the account menu. `assistantFloat`
// floats over the pages.
export function DashboardShell({
  business,
  businesses,
  owner,
  bell,
  assistantFloat,
  children,
}: {
  business: { id: string; slug: string; name: string }
  businesses: OwnedBusiness[]
  owner: { name: string; contact: string; image: string | null }
  bell?: React.ReactNode
  assistantFloat?: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [action, setAction] = useState<TabBarAction | null>(null)
  // The next login opens this business again (/dashboard reads it).
  useEffect(() => {
    document.cookie = `${LAST_BUSINESS_COOKIE}=${business.id}; path=/; max-age=${LAST_BUSINESS_MAX_AGE}; samesite=lax`
  }, [business.id])
  const messages = useOwnerMessages()
  const m = messages.shell.nav
  const base = `/dashboard/${business.id}`
  const assistantHref = `${base}/assistant`
  const assistantOpen = pathname.startsWith(assistantHref)
  const addPage = ADD_PAGES.find((path) => pathname.startsWith(base + path))
  // Until the page gives its own, the + is named for the page and waits.
  const addLabel =
    action?.label ??
    (addPage === "/customers"
      ? messages.bookings.customers.add
      : addPage === "/services"
        ? messages.catalog.services.addService
        : messages.catalog.team.addPerson)
  const items = NAV.map((item) => ({
    ...item,
    label: m[item.key],
    href: base + item.path,
    active: item.path
      ? pathname.startsWith(base + item.path)
      : pathname === base,
  }))
  const tab = (path: string) => {
    const item = items.find((found) => found.path === path)
    if (!item) return null
    return (
      <TabBarLink
        key={item.href}
        href={item.href}
        label={item.label}
        icon={item.icon}
        active={item.active}
      />
    )
  }
  // On a phone the assistant is a full page of its own, with its own back
  // button: no top bar or tab bar. On a computer it fills the page beside
  // the menu, under the top bar.
  return (
    <TooltipProvider>
      <CommandMenuProvider business={business}>
        <SidebarProvider>
          <AppSidebar
            business={business}
            businesses={businesses}
            owner={owner}
          />
          <AppInset className={cn(assistantOpen && "md:h-dvh")}>
            <TopBar
              business={business}
              owner={owner}
              menu
              bell={bell}
              className={cn(assistantOpen && "max-md:hidden")}
            />
            <PageContent
              fill={assistantOpen}
              className={cn(!assistantOpen && "pb-28")}
            >
              <TabBarActionContext value={setAction}>
                <PhotoWordsProvider
                  words={{
                    change: messages.settings.photos.change,
                    addPhoto: messages.settings.photos.addPhoto,
                    remove: messages.settings.photos.remove,
                    errors: {
                      not_found: messages.settings.tryAgain,
                      missing: messages.settings.photos.pick,
                      too_big: messages.settings.photos.tooBig,
                      wrong_type: messages.settings.photos.wrongType,
                      limit: messages.settings.photos.limit(UPLOAD_RULES.maxBusinessPhotos),
                    },
                  }}
                >
                  {children}
                </PhotoWordsProvider>
              </TabBarActionContext>
            </PageContent>
          </AppInset>
          <BottomTabBar
            label={m.owner}
            className={cn("grid-cols-5", assistantOpen && "hidden")}
          >
            {PHONE_LEFT.map((path) => tab(path))}
            <div className="relative flex min-h-14 items-center justify-center">
              {/* The assistant's globe (the computer's floating one), or the
                  open page's + on the app's grey icon fill, spinning from one
                  to the other. */}
              <SpinSwap swapKey={addPage ? "add" : "assistant"}>
                {addPage ? (
                  <Button
                    size="icon-lg"
                    variant="ghost"
                    className={ADD_BUTTON}
                    aria-label={addLabel}
                    // Until the page hands over its action (while it loads,
                    // or as it closes) the + keeps its look and a tap does
                    // nothing; it greys out only when the page says so.
                    disabled={action?.disabled === true}
                    aria-disabled={action ? undefined : true}
                    onClick={action?.onClick}
                  >
                    {/* The app's icon fill (an empty state's icon): grey,
                        dark in dark mode, with the icon in the text colour. */}
                    <span className="grid size-full place-items-center rounded-full bg-muted text-foreground">
                      <PlusIcon className="size-6" />
                    </span>
                  </Button>
                ) : (
                  <Button
                    size="icon-lg"
                    variant="ghost"
                    // The globe fills the whole 44 px, edged with the app's
                    // hairline in its own brand colour, with no gap.
                    className="size-11 rounded-full border-(length:--hairline) border-primary/60 hover:bg-transparent dark:hover:bg-transparent"
                    aria-label={m.assistant}
                    nativeButton={false}
                    render={<Link href={assistantHref} />}
                  >
                    {/* The composer's voice wave on the globe, in the globe's
                        near-white light, a little see-through so the globe's
                        colours tint it. */}
                    <span className="grid size-full place-items-center *:col-start-1 *:row-start-1">
                      <VoiceGlobe className="size-full" />
                      <AudioLinesIcon className="relative size-5 text-primary-foreground/85" />
                    </span>
                  </Button>
                )}
              </SpinSwap>
            </div>
            {PHONE_RIGHT.map((path) => tab(path))}
          </BottomTabBar>
          {assistantFloat}
        </SidebarProvider>
      </CommandMenuProvider>
    </TooltipProvider>
  )
}
