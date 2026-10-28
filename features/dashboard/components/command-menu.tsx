"use client"

import { createContext, use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { ExternalLinkIcon, LanguagesIcon, LogOutIcon } from "@/components/ui/icons"
import { useTheme } from "next-themes"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { PAGE_LANGUAGES } from "@/lib/page-language"
import { useOwnerLanguage, useOwnerMessages } from "../i18n/provider"
import { LANGUAGE_NAMES } from "../i18n/language"
import { NAV_GROUPS } from "../navigation"
import { THEMES, useSignOut } from "./account-menu"

const CommandMenuContext = createContext<(open: boolean) => void>(() => {})

// The search list, like Koblip Sales' ⌘K: type to jump to any page, or to
// switch theme or language, open the public page, or sign out. The menu's
// Search box and ⌘K (Ctrl+K) open it.
export function CommandMenuProvider({
  business,
  children,
}: {
  business: { id: string; slug: string }
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
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
      <CommandMenu business={business} open={open} onOpenChange={setOpen} />
    </CommandMenuContext>
  )
}

export function useCommandMenu() {
  return use(CommandMenuContext)
}

function CommandMenu({
  business,
  open,
  onOpenChange,
}: {
  business: { id: string; slug: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const m = useOwnerMessages().shell
  const { setTheme } = useTheme()
  const [, setLanguage] = useOwnerLanguage()
  const signOut = useSignOut()
  const base = `/dashboard/${business.id}`
  const run = (task: () => void) => {
    onOpenChange(false)
    task()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.search}
      description={m.searchHint}
    >
      <Command>
        <CommandInput placeholder={m.searchHint} />
        <CommandList>
          <CommandEmpty>{m.noResults}</CommandEmpty>
          {NAV_GROUPS.map((group) => (
            <CommandGroup key={group.key} heading={m.groups[group.key]}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.key}
                  onSelect={() =>
                    run(() => router.push(`${base}${item.path}` as Route))
                  }
                >
                  <item.icon />
                  {m.nav[item.key]}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandGroup heading={m.account}>
            <CommandItem
              onSelect={() =>
                run(() => window.open(`/b/${business.slug}`, "_blank"))
              }
            >
              <ExternalLinkIcon />
              {m.viewPage}
            </CommandItem>
            {THEMES.map((item) => (
              <CommandItem
                key={item.value}
                onSelect={() => run(() => setTheme(item.value))}
              >
                <item.icon />
                {`${m.appearance}: ${m[item.key]}`}
              </CommandItem>
            ))}
            {PAGE_LANGUAGES.map((code) => (
              <CommandItem
                key={code}
                onSelect={() => run(() => setLanguage(code))}
              >
                <LanguagesIcon />
                {`${m.language}: ${LANGUAGE_NAMES[code]}`}
              </CommandItem>
            ))}
            <CommandItem onSelect={() => run(() => void signOut())}>
              <LogOutIcon />
              {m.signOut}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
