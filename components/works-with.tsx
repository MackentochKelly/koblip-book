import Image from "next/image"

import { Badge } from "@/components/ui/badge"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"

// The services Koblip Book works with. `soon`: on the roadmap, not built yet.
// Meta and Google logos need their approval, so those are words only
// (meta.com/brand/resources/meta/company-brand,
// partnermarketinghub.withgoogle.com). WhatsApp: its own file from the
// official pack, never recoloured, and its name never joined to other words
// (meta.com/brand/resources/whatsapp/whatsapp-brand).
// A quiet row of service names.
export function WorksWith({ language }: { language: PageLanguage }) {
  const t = messagesFor(language).home
  const services: { logo?: string; name: string; soon?: boolean }[] = [
    { name: "Muse by Meta" },
    { name: "Google Maps" },
    {
      logo: "/brands/whatsapp-glyph-green.svg",
      name: t.remindersOnWhatsApp,
      soon: true,
    },
    { name: "Google Calendar", soon: true },
  ]
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-12">
      <p className="text-sm text-muted-foreground">{t.worksWith}</p>
      <ul className="flex flex-wrap justify-center gap-x-8 gap-y-4">
        {services.map(({ logo, name, soon }) => (
          <li
            key={name}
            className="flex items-center gap-2 text-muted-foreground"
          >
            {logo && (
              <Image src={logo} alt="" width={20} height={20} unoptimized />
            )}
            <span className="font-medium">{name}</span>
            {soon && <Badge variant="secondary">{t.soon}</Badge>}
          </li>
        ))}
      </ul>
    </section>
  )
}
