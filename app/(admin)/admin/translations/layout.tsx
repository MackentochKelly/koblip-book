import { TranslationsFrame } from "@/features/admin/components/translations-frame"

// Admin → Translations (docs/plans/translations.md, G5): tabs, pinned under
// the top bar on a phone. Each part is a route below it.
export default function AdminTranslationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <TranslationsFrame>{children}</TranslationsFrame>
}
