import type messages from "@/i18n/messages"

// next-intl knows every word and its fields, so a wrong key or a missing
// field fails the typecheck
// (node_modules/use-intl/dist/types/core/AppConfig.d.ts).
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages
  }
}
