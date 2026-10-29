"use client"

import { MoonIcon, SunIcon } from "@/components/ui/icons"
import { useTheme } from "next-themes"

import { useMessages } from "@/components/language-provider"
import { Button } from "@/components/ui/button"

// One tap switches the page between light and dark. The icon follows the
// page's own dark class, so the server and the browser draw the same button.
export function ThemeToggle({
  size = "icon",
  className,
}: {
  size?: "icon" | "icon-sm"
  className?: string
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const label = useMessages().page.theme
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={className}
      aria-label={label}
      title={label}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}
