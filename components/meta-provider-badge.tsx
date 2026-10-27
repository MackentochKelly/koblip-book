import Image from "next/image"
import { BadgeCheckIcon, ChevronRightIcon, ShieldCheckIcon } from "lucide-react"

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
import { cn } from "@/lib/utils"

// What being a Meta Tech Provider lets Koblip Book do. `soon`: on the
// roadmap, not built yet. WhatsApp: its own file from the official pack,
// never recoloured, its name never joined to other words
// (meta.com/brand/resources/whatsapp/whatsapp-brand).
const FEATURES = [
  {
    whatsapp: true,
    title: "Your own WhatsApp number",
    description: "Connect your business number in a few taps.",
    soon: true,
  },
  {
    whatsapp: true,
    title: "Reminders on WhatsApp",
    description: "Clients get their booking reminders on WhatsApp.",
    soon: true,
  },
  {
    whatsapp: false,
    title: "Checked by Meta",
    description: "Meta verified our business and approved us to connect yours.",
    soon: false,
  },
] as const

// The home page's glass pill. Plain words only: Meta's logo needs Meta's
// approval (meta.com/brand/resources/meta/company-brand). Tap it to see
// what it means.
export function MetaProviderBadge() {
  return (
    <Dialog>
      <DialogTrigger
        nativeButton={false}
        render={
          <Badge
            variant="outline"
            className={cn(
              glassButtonClassName,
              "h-auto cursor-pointer self-center px-3 py-1 text-sm"
            )}
          />
        }
      >
        <BadgeCheckIcon data-icon="inline-start" />
        Verified Meta Tech Provider
        <ChevronRightIcon data-icon="inline-end" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verified Meta Tech Provider</DialogTitle>
          <DialogDescription>
            Meta approved Koblip to connect businesses to WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <ItemGroup className="gap-2">
          {FEATURES.map(({ whatsapp, title, description, soon }) => (
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
                  {soon && <Badge variant="secondary">Soon</Badge>}
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
