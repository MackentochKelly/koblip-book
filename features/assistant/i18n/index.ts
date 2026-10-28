import type { PageLanguage } from "@/lib/page-language"
import en from "./en"
import es from "./es"

export type AssistantMessages = typeof en

const MESSAGES: Record<PageLanguage, AssistantMessages> = { en, es }

export function assistantMessagesFor(
  language: PageLanguage
): AssistantMessages {
  return MESSAGES[language]
}
