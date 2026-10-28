import { MessageCircleIcon, PhoneIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { phoneLinks } from "@/lib/phone-link"
import { useOwnerMessages } from "../i18n/provider"

// Call or WhatsApp a customer, side by side.
export function ContactButtons({ phone }: { phone: string }) {
  const t = useOwnerMessages().bookings.contact
  const links = phoneLinks(phone)
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="outline"
        nativeButton={false}
        render={<a href={links.tel} />}
      >
        <PhoneIcon data-icon="inline-start" />
        {t.call}
      </Button>
      <Button
        variant="outline"
        nativeButton={false}
        render={<a href={links.whatsapp} target="_blank" rel="noreferrer" />}
      >
        <MessageCircleIcon data-icon="inline-start" />
        {t.whatsapp}
      </Button>
    </div>
  )
}
