import Link from "next/link"
import { GoogleMapsCredit } from "@/components/google-maps-credit"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import { policySegment, type PolicyLink } from "@/lib/policy-rules"
import { TOUCH_AREA } from "@/lib/touch-area"
import { cn } from "@/lib/utils"

// Who the page belongs to, its policies, where its Google details come
// from, and who built it.
export function BusinessFooter({
  name,
  slug,
  policies,
  fromGoogle,
  language,
}: {
  name: string
  slug: string
  policies: PolicyLink[]
  fromGoogle: boolean
  language: PageLanguage
}) {
  const messages = messagesFor(language)
  const m = messages.footer
  return (
    <footer className="flex flex-col items-center gap-1 pt-4 text-center text-xs text-muted-foreground">
      {policies.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-3 pb-2">
          {policies.map((policy) => (
            <li key={policy.id}>
              <Link
                href={`/b/${slug}/policies/${policySegment(policy)}?lang=${language}`}
                className={cn(
                  TOUCH_AREA,
                  "transition-colors hover:text-foreground"
                )}
              >
                {policy.kind ? messages.policies[policy.kind] : policy.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
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
