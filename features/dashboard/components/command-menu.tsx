"use client"

import { createContext, use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import type { Route } from "next"
import {
  ExternalLinkIcon,
  LanguagesIcon,
  LogOutIcon,
} from "@/components/ui/icons"
import { useTheme } from "next-themes"

import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandShortcut,
  CommandList,
} from "@/components/ui/command"
import { useIsMobile } from "@/hooks/use-mobile"
import { LANGUAGE_NAMES, PAGE_LANGUAGES } from "@/lib/page-language"
import { useOwnerLanguage } from "@/components/app-language"
import { NAV_GROUPS, navFeature } from "../navigation"
import type { LockedPlans } from "../types"
import { THEMES, useSignOut } from "@/components/account-menu"

const CommandMenuContext = createContext<(open: boolean) => void>(() => {})

// The search list, like Koblip Sales' ⌘K: type to jump to any page, or to
// switch theme or language, open the public page, or sign out. The menu's
// Search box and ⌘K (Ctrl+K) open it.
export function CommandMenuProvider({
  business,
  lockedPlans,
  children,
}: {
  business: { id: string; slug: string }
  // A page the plan lacks shows its plan (docs/plans/subscriptions.md, P5e).
  lockedPlans: LockedPlans
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Picking a saved email from Chrome's autofill sends a keydown with
      // no key, which would crash here.
      if (
        typeof event.key === "string" &&
        event.key.toLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])
  return (
    <CommandMenuContext value={setOpen}>
      {children}
      <CommandMenu
        business={business}
        lockedPlans={lockedPlans}
        open={open}
        onOpenChange={setOpen}
      />
    </CommandMenuContext>
  )
}

export function useCommandMenu() {
  return use(CommandMenuContext)
}

function CommandMenu({
  business,
  lockedPlans,
  open,
  onOpenChange,
}: {
  business: { id: string; slug: string }
  lockedPlans: LockedPlans
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const t = useTranslations("owner.shell")
  const plans = useTranslations("app.planLocked.plans")
  const { setTheme } = useTheme()
  const [, setLanguage] = useOwnerLanguage()
  const signOut = useSignOut()
  const phone = useIsMobile()
  const base = `/dashboard/${business.id}`
  const run = (task: () => void) => {
    onOpenChange(false)
    task()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("search")}
      description={t("searchHint")}
    >
      <Command>
        <CommandInput placeholder={t("searchHint")} />
        <CommandList className="scroll-fade">
          <CommandEmpty>{t("noResults")}</CommandEmpty>
          {NAV_GROUPS.map((group) => (
            <CommandGroup
              key={group.key}
              heading={
                group.key === "main" ? undefined : t(`groups.${group.key}`)
              }
            >
              {group.items.map((item) => {
                const feature = navFeature(item)
                const needs = feature ? lockedPlans[feature] : undefined
                return (
                  <CommandItem
                    key={item.key}
                    onSelect={() =>
                      run(() => router.push(`${base}${item.path}` as Route))
                    }
                  >
                    <item.icon />
                    {/* As in the menu: Dashboard on a computer. */}
                    {item.key === "home" && !phone
                      ? t("nav.dashboard")
                      : t(`nav.${item.key}`)}
                    {/* At the row's end, where shadcn puts a shortcut. */}
                    {needs && (
                      <CommandShortcut>
                        <Badge variant="secondary">{plans(needs)}</Badge>
                      </CommandShortcut>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}
          <CommandGroup heading={t("account")}>
            <CommandItem
              onSelect={() =>
                run(() => window.open(`/b/${business.slug}`, "_blank"))
              }
            >
              <ExternalLinkIcon />
              {t("viewPage")}
            </CommandItem>
            {THEMES.map((item) => (
              <CommandItem
                key={item.value}
                onSelect={() => run(() => setTheme(item.value))}
              >
                <item.icon />
                {t("appearanceChoice", { theme: t(item.key) })}
              </CommandItem>
            ))}
            {PAGE_LANGUAGES.map((code) => (
              <CommandItem
                key={code}
                onSelect={() => run(() => setLanguage(code))}
              >
                <LanguagesIcon />
                {t("languageChoice", { language: LANGUAGE_NAMES[code] })}
              </CommandItem>
            ))}
            <CommandItem onSelect={() => run(() => void signOut())}>
              <LogOutIcon />
              {t("signOut")}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
