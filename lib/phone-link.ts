// A phone number as tel: and WhatsApp (wa.me) links: digits only, with the
// leading + kept for tel: and dropped for wa.me.
export function phoneLinks(phone: string): { tel: string; whatsapp: string } {
  const clean = phone.replace(/[^\d+]/g, "")
  return {
    tel: `tel:${clean}`,
    whatsapp: `https://wa.me/${clean.replace(/^\+/, "")}`,
  }
}
