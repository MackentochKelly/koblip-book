"use client"

import Link from "next/link"

import { useMessages, usePageLanguage } from "@/components/language-provider"
import { DEFAULT_LANGUAGE } from "@/lib/page-language"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Opens booking: on a phone the booking sheet over this page, on a computer
// the booking page. A service id starts it on that service. The sheet opens
// by changing only the address (the browser's history, which Next.js keeps
// in sync), so the page is not loaded again from the server.
export function BookButton({
  slug,
  serviceId,
  label,
  variant = "default",
  size = "lg",
  className,
}: {
  slug: string
  serviceId?: string
  label?: string
  variant?: "default" | "outline"
  size?: "lg" | "sm"
  className?: string
}) {
  const m = useMessages()
  const language = usePageLanguage()
  const text = label ?? m.actions.bookNow
  // The page's language goes along (?lang=), so booking speaks it too.
  const query = new URLSearchParams()
  if (serviceId) query.set("service", serviceId)
  if (language !== DEFAULT_LANGUAGE) query.set("lang", language)
  const extra = query.size > 0 ? `${query}` : ""
  const sheet = `/b/${slug}?book=1${extra && `&${extra}`}`
  const page = `/b/${slug}/book${extra && `?${extra}`}`
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn("md:hidden", className)}
        nativeButton={false}
        render={
          <a
            href={sheet}
            onClick={(event) => {
              event.preventDefault()
              window.history.pushState(null, "", sheet)
            }}
          />
        }
      >
        {text}
      </Button>
      <Button
        variant={variant}
        size={size}
        className={cn("hidden md:inline-flex", className)}
        nativeButton={false}
        render={<Link href={page} />}
      >
        {text}
      </Button>
    </>
  )
}
