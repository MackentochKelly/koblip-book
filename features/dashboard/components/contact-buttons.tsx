import { useTranslations } from "next-intl"
import { WhatsAppIcon, PhoneIcon } from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import { phoneLinks } from "@/lib/phone-link"

// Call or WhatsApp a customer, side by side.
export function ContactButtons({ phone }: { phone: string }) {
  const t = useTranslations("owner.bookings.contact")
  const links = phoneLinks(phone)
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="outline"
        nativeButton={false}
        render={<a href={links.tel} />}
      >
        <PhoneIcon data-icon="inline-start" />
        {t("call")}
      </Button>
      <Button
        variant="outline"
        nativeButton={false}
        render={<a href={links.whatsapp} target="_blank" rel="noreferrer" />}
      >
        <WhatsAppIcon data-icon="inline-start" />
        {t("whatsapp")}
      </Button>
    </div>
  )
}
