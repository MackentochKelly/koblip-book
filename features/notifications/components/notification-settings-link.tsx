"use client"

import Link from "next/link"

import { BellIcon, ChevronRightIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import type { PageLanguage } from "@/lib/page-language"
import { notificationMessagesFor } from "../i18n"

// The way from the business's Settings to the notification choices (N7);
// the bell's gear leads there too.
export function NotificationSettingsLink({
  href,
  language,
}: {
  href: string
  language: PageLanguage
}) {
  const t = notificationMessagesFor(language)
  return (
    <Item variant="outline" render={<Link href={href} />}>
      <ItemMedia variant="icon">
        <BellIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{t.choices.title}</ItemTitle>
      </ItemContent>
      <ItemActions>
        <ChevronRightIcon className="size-4 text-muted-foreground" />
      </ItemActions>
    </Item>
  )
}
