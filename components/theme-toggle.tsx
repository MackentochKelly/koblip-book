"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

// One tap switches the page between light and dark.
export function ThemeToggle({ size = "icon" }: { size?: "icon" | "icon-sm" }) {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  const label = dark ? "Light mode" : "Dark mode"
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      aria-label={label}
      title={label}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}
