"use client"

import { useRouter } from "next/navigation"
import {
  ChevronDownIcon,
  LanguagesIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "@/components/ui/icons"
import { useTheme } from "next-themes"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useOwnerLanguage,
  useOwnerMessages,
} from "@/features/dashboard/i18n/provider"
import { LANGUAGE_NAMES } from "@/features/dashboard/i18n/language"
import { authClient } from "@/lib/auth-client"
import { PAGE_LANGUAGES, isPageLanguage } from "@/lib/page-language"
import { initials } from "@/lib/initials"
import { cn } from "@/lib/utils"

export interface Owner {
  name: string
  email: string
  image: string | null
}

// The owner's photo (from Google) or initials.
export function OwnerAvatar({
  owner,
  className,
}: {
  owner: Owner
  className?: string
}) {
  return (
    <Avatar className={cn("size-9", className)}>
      {owner.image && (
        <AvatarImage src={owner.image} alt="" referrerPolicy="no-referrer" />
      )}
      <AvatarFallback>{initials(owner.name) || "?"}</AvatarFallback>
    </Avatar>
  )
}

// The owner's account menu, like Koblip Sales': their photo with a small ⌄
// badge on its corner and a ring on hover and while open, so it reads as a
// menu. Inside: who is logged in, light or dark (or as the device is), the
// language, and Sign out.
export const THEMES = [
  { value: "light", key: "light", icon: SunIcon },
  { value: "dark", key: "dark", icon: MoonIcon },
  { value: "system", key: "device", icon: MonitorIcon },
] as const

// Signs out and goes home; the account menu and the search list both use it.
export function useSignOut() {
  const router = useRouter()
  return async () => {
    await authClient.signOut()
    router.replace("/")
    router.refresh()
  }
}

export function AccountMenu({ owner }: { owner: Owner }) {
  const m = useOwnerMessages().shell
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={m.account}
            className="relative rounded-full hover:bg-transparent hover:ring-2 hover:ring-border data-popup-open:ring-2 data-popup-open:ring-border"
          />
        }
      >
        <OwnerAvatar owner={owner} />
        <span
          aria-hidden
          className="absolute -right-1 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-muted text-foreground ring-2 ring-background [&_svg]:size-3! [&_svg]:stroke-2"
        >
          <ChevronDownIcon />
        </span>
      </DropdownMenuTrigger>
      <AccountMenuContent owner={owner} align="end" />
    </DropdownMenu>
  )
}

// What the account menu holds; the top bar's photo and the menu's footer
// (NavUser) both open it.
export function AccountMenuContent({
  owner,
  side,
  align,
  sideOffset,
}: {
  owner: Owner
} & Pick<
  React.ComponentProps<typeof DropdownMenuContent>,
  "side" | "align" | "sideOffset"
>) {
  const { theme, setTheme } = useTheme()
  const m = useOwnerMessages().shell
  const [language, setLanguage] = useOwnerLanguage()
  const signOut = useSignOut()

  return (
    <DropdownMenuContent
      side={side}
      align={align}
      sideOffset={sideOffset}
      className="w-64"
    >
      <DropdownMenuGroup>
        <DropdownMenuLabel className="flex items-center gap-2 font-normal">
          <OwnerAvatar owner={owner} />
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate font-medium text-foreground">
              {owner.name}
            </span>
            <span className="truncate text-xs">{owner.email}</span>
          </span>
        </DropdownMenuLabel>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>{m.appearance}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          {THEMES.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              <item.icon />
              {m[item.key]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>{m.language}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={language}
          onValueChange={(next) => {
            if (isPageLanguage(next)) setLanguage(next)
          }}
        >
          {PAGE_LANGUAGES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code} lang={code}>
              <LanguagesIcon />
              {LANGUAGE_NAMES[code]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => void signOut()}>
        <LogOutIcon />
        {m.signOut}
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
