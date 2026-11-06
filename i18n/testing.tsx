import { createTranslator, NextIntlClientProvider } from "next-intl"

import messages from "./messages"

// Tests only: the app's English words as next-intl gives them.

// Wraps a client component so useTranslations has the words:
// render(<WithWords><MyPart /></WithWords>).
export function WithWords({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en-US" messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  )
}

// For vi.mock("next-intl/server", () => serverWords()): server code gets
// the English words.
export function serverWords() {
  const translator = (options?: string | { namespace?: string }) =>
    createTranslator({
      locale: "en-US",
      messages,
      namespace: (typeof options === "string" ? options : options?.namespace) as never,
    })
  return {
    getTranslations: async (options?: string | { namespace?: string }) =>
      translator(options),
    getLocale: async () => "en-US",
    getMessages: async () => messages,
  }
}
