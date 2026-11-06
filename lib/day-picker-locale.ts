import { es, fr, ptBR, type DayPickerLocale } from "react-day-picker/locale"

import { languageOf, type PageLanguage } from "./page-language"

// The calendar's month and weekday names and its labels in each page
// language (react-day-picker's own locales); English is the calendar's own.
const DAY_PICKER_LOCALES: Record<PageLanguage, DayPickerLocale | undefined> = {
  en: undefined,
  es,
  pt: ptBR,
  fr,
}

// The calendar's locale for next-intl's format locale ("pt-PT" → ptBR).
export function dayPickerLocale(locale: string): DayPickerLocale | undefined {
  return DAY_PICKER_LOCALES[languageOf(locale)]
}
