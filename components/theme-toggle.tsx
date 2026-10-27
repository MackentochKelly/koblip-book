"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

// One tap switches the page between light and dark. The icon follows the
// page's own dark class, so the server and the browser draw the same button.
export function ThemeToggle({ size = "icon" }: { size?: "icon" | "icon-sm" }) {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      aria-label="Light or dark mode"
      title="Light or dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}
