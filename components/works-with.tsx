import Image from "next/image"

import { HomeRowLabel } from "@/components/home-section-title"
import { Badge } from "@/components/ui/badge"
import { messagesFor } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { PageLanguage } from "@/lib/page-language"

// The services Koblip Book works with, each with its own logo, unaltered:
// Meta's symbol from its brand pack (colour on light, white on dark), and
// Google's own Maps and Calendar icons. WhatsApp: its own file from the
// official pack, never recoloured, and its name never joined to other words
// (meta.com/brand/resources/whatsapp/whatsapp-brand). `soon`: on the
// roadmap, not built yet.
// A quiet row of service names.
export function WorksWith({ language }: { language: PageLanguage }) {
  const t = messagesFor(language).home
  const services: {
    logo: string
    logoDark?: string
    name: string
    soon?: boolean
  }[] = [
    {
      logo: "/brands/meta-symbol.png",
      logoDark: "/brands/meta-symbol-white.png",
      name: "Muse by Meta",
    },
    { logo: "/brands/google-maps.svg", name: "Google Maps" },
    {
      logo: "/brands/whatsapp-glyph-green.svg",
      name: t.remindersOnWhatsApp,
      soon: true,
    },
    {
      logo: "/brands/google-calendar.png",
      name: "Google Calendar",
      soon: true,
    },
  ]
  return (
    <section className="mx-auto flex w-full max-w-page flex-col items-center gap-6 px-4 pt-24 pb-16 md:pt-32">
      <HomeRowLabel>{t.worksWith}</HomeRowLabel>
      <ul className="flex flex-wrap justify-center gap-x-8 gap-y-4">
        {services.map(({ logo, logoDark, name, soon }) => (
          <li
            key={name}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <Logo
              src={logo}
              className={cn("size-5 object-contain", logoDark && "dark:hidden")}
            />
            {logoDark && (
              <Logo
                src={logoDark}
                className="hidden size-5 object-contain dark:block"
              />
            )}
            <span className="font-medium">{name}</span>
            {soon && <Badge variant="secondary">{t.soon}</Badge>}
          </li>
        ))}
      </ul>
    </section>
  )
}

// One logo, shown whole at the row's icon size.
function Logo({ src, className }: { src: string; className: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={20}
      height={20}
      unoptimized
      className={className}
    />
  )
}
