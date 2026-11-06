import "server-only"

import {
  flattenWords,
  registerEnglishWords,
  wordModule,
} from "@/lib/translations/interface-words"
import { syncTexts } from "@/lib/translations/queue"
import messages from "./messages"

// Brings the app's words in the database in line with the English in code
// (docs/plans/translations.md, G4), once when the server starts: a new word
// waits for Google, a changed one waits again (an admin's own translation
// stays and needs review), a removed one goes (its history stays).
export async function syncInterfaceWords() {
  registerEnglishWords(messages)
  return syncTexts({
    scope: "interface",
    businessId: null,
    items: flattenWords(messages).map(({ key, text }) => ({
      key,
      module: wordModule(key),
      text,
    })),
    removeMissing: true,
  })
}
