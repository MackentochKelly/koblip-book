import { WhatsappFrame } from "@/features/admin/components/whatsapp-frame"

// The admin's WhatsApp section: tabs, pinned under the top bar on a phone. Each
// part is a route below it (docs/plans/whatsapp-notifications.md, A1).
export default function AdminWhatsappLayout({ children }: { children: React.ReactNode }) {
  return <WhatsappFrame>{children}</WhatsappFrame>
}
