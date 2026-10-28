import { OwnerLanguageProvider } from "@/features/dashboard/i18n/provider"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"

// Every owner page (login, setup, dashboard) speaks the owner's language.
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <OwnerLanguageProvider language={await getOwnerLanguage()}>
      {children}
    </OwnerLanguageProvider>
  )
}
