import { GoogleMapsCredit } from "@/components/google-maps-credit"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"

// Who the page belongs to, where its Google details come from, and who built it.
export function BusinessFooter({
  name,
  fromGoogle,
  language,
}: {
  name: string
  fromGoogle: boolean
  language: PageLanguage
}) {
  const m = messagesFor(language).footer
  return (
    <footer className="flex flex-col items-center gap-1 pt-4 text-center text-xs text-muted-foreground">
      <p>
        © {new Date().getFullYear()} {name}. {m.rights}
      </p>
      {fromGoogle && (
        <p className="flex flex-wrap items-center justify-center">
          {m.fromGoogle}
          <GoogleMapsCredit />
        </p>
      )}
      <p>
        {m.builtBy} <span className="font-medium text-foreground">Koblip</span>
      </p>
    </footer>
  )
}
