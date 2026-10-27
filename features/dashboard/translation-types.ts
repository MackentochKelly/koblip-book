export interface TranslationStatus {
  language: "es"
  enabled: boolean // false when Meta AI is off (no MODEL_API_KEY)
  total: number // texts that need a translation: About (if any) + every service name + every service description (if any) + every add-on group prompt + every add-on option name + every add-on option description (if any)
  upToDate: number
}
