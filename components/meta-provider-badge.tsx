import Image from "next/image"
import {
  BadgeCheckIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
} from "@/components/ui/icons"

import { glassButtonClassName } from "@/components/glass-frame"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import { TOUCH_AREA } from "@/lib/touch-area"
import { cn } from "@/lib/utils"

// The home page's glass pill. Plain words only: Meta's logo needs Meta's
// approval (meta.com/brand/resources/meta/company-brand). Tap it to see
// what it means.
export function MetaProviderBadge({ language }: { language: PageLanguage }) {
  const home = messagesFor(language).home
  const t = home.provider
  // What being a Meta Tech Provider lets Koblip Book do. `soon`: on the
  // roadmap, not built yet. WhatsApp: its own file from the official pack,
  // never recoloured, its name never joined to other words
  // (meta.com/brand/resources/whatsapp/whatsapp-brand).
  const features = [
    {
      whatsapp: true,
      title: t.ownNumber,
      description: t.ownNumberText,
      soon: true,
    },
    {
      whatsapp: true,
      title: t.reminders,
      description: t.remindersText,
      soon: true,
    },
    {
      whatsapp: false,
      title: t.checked,
      description: t.checkedText,
      soon: false,
    },
  ]
  return (
    <Dialog>
      <DialogTrigger
        nativeButton={false}
        render={
          <Badge
            variant="outline"
            className={cn(
              glassButtonClassName,
              TOUCH_AREA,
              "h-auto cursor-pointer self-center overflow-visible px-3 py-1 text-sm"
            )}
          />
        }
      >
        <BadgeCheckIcon data-icon="inline-start" />
        {t.badge}
        <ChevronRightIcon data-icon="inline-end" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.badge}</DialogTitle>
          <DialogDescription>{t.about}</DialogDescription>
        </DialogHeader>
        <ItemGroup className="gap-2">
          {features.map(({ whatsapp, title, description, soon }) => (
            <Item key={title} variant="muted" size="sm">
              <ItemMedia variant="icon">
                {whatsapp ? (
                  <Image
                    src="/brands/whatsapp-glyph-green.svg"
                    alt=""
                    width={20}
                    height={20}
                    unoptimized
                  />
                ) : (
                  <ShieldCheckIcon />
                )}
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {title}
                  {soon && <Badge variant="secondary">{home.soon}</Badge>}
                </ItemTitle>
                <ItemDescription>{description}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      </DialogContent>
    </Dialog>
  )
}
