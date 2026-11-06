import type { Messages } from "next-intl"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"

// Gives client components the words of the parts they use
// (useTranslations), and only those: every word would make each page's
// download larger. Locale and formats come from i18n/request.ts. Put it
// where the language can change: a page whose ?lang= changes keeps its
// layout, so a public page has it in the page itself.
export async function WordsProvider({
  namespaces,
  children,
}: {
  namespaces: readonly (keyof Messages)[]
  children: React.ReactNode
}) {
  const messages = await getMessages()
  const picked: Partial<Messages> = {}
  for (const namespace of namespaces) {
    Object.assign(picked, { [namespace]: messages[namespace] })
  }
  return (
    <NextIntlClientProvider messages={picked}>{children}</NextIntlClientProvider>
  )
}
