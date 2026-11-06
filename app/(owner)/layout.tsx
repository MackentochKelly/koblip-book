import { WordsProvider } from "@/components/words-provider"
import { OwnerLanguageProvider } from "@/components/app-language"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"

// Every owner page (login, setup, dashboard) speaks the owner's language.
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <OwnerLanguageProvider language={await getOwnerLanguage()}>
      <WordsProvider
        namespaces={[
          "app",
          "assistant",
          "billing",
          "notifications",
          "onboarding",
          "owner",
          "ownerAuth",
          "public",
          "starterCatalog",
        ]}
      >
        {children}
      </WordsProvider>
    </OwnerLanguageProvider>
  )
}
