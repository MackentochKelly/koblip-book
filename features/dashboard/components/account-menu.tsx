"use client"

import { useRouter } from "next/navigation"
import {
  ChevronDownIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react"
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
import { authClient } from "@/lib/auth-client"
import { initials } from "@/lib/initials"

interface Owner {
  name: string
  email: string
  image: string | null
}

// The owner's photo (from Google) or initials.
function OwnerAvatar({ owner }: { owner: Owner }) {
  return (
    <Avatar className="size-9">
      {owner.image && (
        <AvatarImage src={owner.image} alt="" referrerPolicy="no-referrer" />
      )}
      <AvatarFallback>{initials(owner.name) || "?"}</AvatarFallback>
    </Avatar>
  )
}

// The owner's account menu, like Koblip Sales': their photo with a small ⌄
// badge on its corner and a ring on hover and while open, so it reads as a
// menu. Inside: who is logged in, light or dark (or as the device is), and
// Sign out.
const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "Device", icon: MonitorIcon },
]

export function AccountMenu({ owner }: { owner: Owner }) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const signOut = async () => {
    await authClient.signOut()
    router.replace("/")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Account"
            className="relative rounded-full hover:bg-transparent hover:ring-2 hover:ring-border data-popup-open:ring-2 data-popup-open:ring-border"
          />
        }
      >
        <OwnerAvatar owner={owner} />
        <span
          aria-hidden
          className="absolute -right-1 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-muted text-foreground ring-2 ring-background [&_svg]:size-[11px]! [&_svg]:stroke-2"
        >
          <ChevronDownIcon />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
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
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme ?? "system"}
            onValueChange={setTheme}
          >
            {THEMES.map((item) => (
              <DropdownMenuRadioItem key={item.value} value={item.value}>
                <item.icon />
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
