"use client"

import { useEffect, useState } from "react"
import { ChevronRightIcon } from "@/components/ui/icons"

import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import type { PageLanguage } from "@/lib/page-language"
import type { AssistantMessages } from "../i18n"
import type { AssistantChatSummary } from "../types"
import { listChats } from "../utils/chats-client"

// The owner's saved chats, newest first; a tap opens one.
export function RecentChats({
  businessId,
  language,
  labels,
  onOpen,
}: {
  businessId: string
  language: PageLanguage
  labels: AssistantMessages["recent"]
  onOpen: (id: string) => void
}) {
  // null while loading; false when the list could not load.
  const [chats, setChats] = useState<AssistantChatSummary[] | null | false>(
    null
  )
  useEffect(() => {
    let live = true
    void listChats(businessId).then((found) => {
      if (live) setChats(found ?? false)
    })
    return () => {
      live = false
    }
  }, [businessId])

  if (chats === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (chats === false || chats.length === 0) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyTitle>
            {chats === false ? labels.failed : labels.empty}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  const when = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  })
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <ItemGroup className="mx-auto max-w-3xl gap-3">
        {chats.map((chat) => (
          <Item
            key={chat.id}
            variant="outline"
            render={<button type="button" onClick={() => onOpen(chat.id)} />}
            className="text-left"
          >
            <ItemContent>
              <ItemTitle>{chat.title}</ItemTitle>
              <ItemDescription>
                {when.format(new Date(chat.updatedAt))}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRightIcon />
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </div>
  )
}
