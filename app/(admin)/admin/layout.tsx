import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Toaster } from "@/components/ui/sonner"
import { WordsProvider } from "@/components/words-provider"
import { AdminShell } from "@/features/admin/components/admin-shell"
import { requireAdmin } from "@/lib/dal"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin")
  return {
    title: t("admin"),
    robots: { index: false, follow: false },
  }
}

// Only the app's admins get in; anyone else sees "not found". The admin's
// language is the page's own (proxy.ts, i18n/request.ts).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()
  return (
    <WordsProvider namespaces={["admin", "app", "reviews"]}>
      <AdminShell>{children}</AdminShell>
      <Toaster />
    </WordsProvider>
  )
}
