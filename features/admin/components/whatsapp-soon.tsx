import { useTranslations } from "next-intl"

import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { WHATSAPP_PARTS, type WhatsappPart } from "../utils/whatsapp-parts"

// A WhatsApp part whose screen is not built yet (its task in
// docs/plans/whatsapp-notifications.md replaces this).
export function WhatsappSoon({ part }: { part: WhatsappPart }) {
  const t = useTranslations("admin.whatsapp")
  const Icon = WHATSAPP_PARTS.find((item) => item.id === part)!.icon
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{t("soon")}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}
