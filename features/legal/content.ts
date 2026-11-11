// The Privacy and Terms pages: their sections and points, in order. The
// words are in the public.legal messages (lib/i18n/en/public.ts).
// The day the text last changed (shown at the top of each page).
export const LEGAL_UPDATED = new Date("2026-11-07T12:00:00Z")

export const LEGAL_CONTACT = "contact@koblip.com"

export type LegalDoc = "privacy" | "terms"

// One section's message keys under public.legal, typed per section so a
// point that is not in the messages fails the typecheck.
function section<D extends LegalDoc, S extends string, P extends string>(
  doc: D,
  name: S,
  points: readonly P[]
) {
  return {
    title: `${doc}.sections.${name}.title` as const,
    points: points.map(
      (point) => `${doc}.sections.${name}.points.${point}` as const
    ),
  }
}

export const LEGAL_SECTIONS = {
  privacy: [
    section("privacy", "collect", ["account", "business", "clients", "chats", "billing", "cardPayments"]),
    section("privacy", "device", ["cookies", "theme", "location"]),
    section("privacy", "helpers", ["providers", "noSale"]),
    section("privacy", "keep", ["open", "unclaimed"]),
    section("privacy", "choices", ["yourData", "clients"]),
  ],
  terms: [
    section("terms", "account", ["safe", "claim"]),
    section("terms", "content", ["responsible", "allowed"]),
    section("terms", "bookings", ["agreement", "refunds", "cardPayments"]),
    section("terms", "assistant", ["confirm", "google"]),
    section("terms", "billing", [
      "free",
      "pro",
      "charge",
      "cancel",
      "refunds",
      "priceChange",
      "reminder",
    ]),
    section("terms", "ending", ["close", "asIs", "changes", "questions"]),
  ],
}
