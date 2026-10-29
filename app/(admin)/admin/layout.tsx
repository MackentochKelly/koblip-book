import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"
import { AdminShell } from "@/features/admin/components/admin-shell"
import { AdminLanguageProvider } from "@/features/admin/i18n/provider"
import { getAdminLanguage } from "@/features/admin/i18n/server"
import { requireAdmin } from "@/lib/dal"

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
}

// Only the app's admins get in; anyone else sees "not found".
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()
  return (
    <AdminLanguageProvider language={await getAdminLanguage()}>
      <AdminShell>{children}</AdminShell>
      <Toaster />
    </AdminLanguageProvider>
  )
}
