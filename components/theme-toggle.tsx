"use client"

import { MoonIcon, SunIcon } from "@/components/ui/icons"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

// One tap switches the page between light and dark. The icon follows the
// page's own dark class, so the server and the browser draw the same button.
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const t = useTranslations("app.themeToggle")
  const label = t("label")
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
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
