import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"

// On a page no one manages yet: the owner can take it over for free.
export function ClaimCard({
  slug,
  language,
}: {
  slug: string
  language: PageLanguage
}) {
  const m = messagesFor(language).claim
  return (
    <Item variant="muted">
      <ItemContent>
        <ItemTitle>{m.title}</ItemTitle>
        <ItemDescription>{m.description}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/dashboard/claim/${slug}`} />}
        >
          {m.button}
        </Button>
      </ItemActions>
    </Item>
  )
}
