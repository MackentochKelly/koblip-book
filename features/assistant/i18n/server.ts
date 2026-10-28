import "server-only"

import en from "./server-en"
import es from "./server-es"

export type ServerMessages = typeof en

// Unknown or missing languages fall back to English. The language comes
// from the owner's cookie (getOwnerLanguage), never from the request
// body, so callers pass a plain string.
export function serverMessagesFor(language: string | undefined): ServerMessages {
  return language === "es" ? es : en
}
