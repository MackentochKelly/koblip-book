"use client"

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import type { PageLanguage } from "@/lib/page-language"
import { markAllNotificationsRead, markNotificationRead } from "../api/actions"
import { notificationMessagesFor, type NotificationMessages } from "../i18n"
import type { InAppFeed, InAppNotification } from "../types/notifications"
import { mergePage } from "../utils/notification-view"

type Feed = {
  t: NotificationMessages
  unread: number
  items: InAppNotification[]
  // Null until the first answer; then whether older ones are left.
  nextCursor: string | null
  loaded: boolean
  failed: boolean
  loadingMore: boolean
  settingsHref: string
  reload: () => void
  loadMore: () => void
  markRead: (id: string) => void
  markAll: () => void
}

const FeedContext = createContext<Feed | null>(null)

async function fetchFeed(cursor?: string): Promise<InAppFeed> {
  const url = cursor
    ? `/api/notifications?cursor=${encodeURIComponent(cursor)}`
    : "/api/notifications"
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`notifications: ${res.status}`)
  return res.json()
}

// The bell's state for the owner area, once for every bell on the page (the
// phone's top bar and the computer's sidebar). The first count comes from
// the server; then the bell asks GET /api/notifications every
// `pollSeconds` while the tab is shown, and at once when it comes back
// (docs/plans/in-app-notifications.md, N-D3).
export function NotificationsProvider({
  language,
  initialUnread,
  pollSeconds,
  settingsHref,
  children,
}: {
  language: PageLanguage
  initialUnread: number
  pollSeconds: number
  settingsHref: string
  children: React.ReactNode
}) {
  const t = notificationMessagesFor(language)
  const [unread, setUnread] = useState(initialUnread)
  const [items, setItems] = useState<InAppNotification[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // Whether "Show more" ran: then the cursor is the oldest loaded page's.
  const pagedRef = useRef(false)

  // The server's count after a read action refreshes the page.
  const [seenInitial, setSeenInitial] = useState(initialUnread)
  if (initialUnread !== seenInitial) {
    setSeenInitial(initialUnread)
    setUnread(initialUnread)
  }

  const reload = useCallback(() => {
    fetchFeed()
      .then((feed) => {
        setUnread(feed.unread)
        setItems((shown) => mergePage(feed.page.items, shown))
        if (!pagedRef.current) setNextCursor(feed.page.nextCursor)
        setLoaded(true)
        setFailed(false)
      })
      .catch(() => setFailed(true))
  }, [])

  useEffect(() => {
    let timer: number | undefined
    function start() {
      window.clearInterval(timer)
      timer = window.setInterval(reload, pollSeconds * 1000)
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        reload()
        start()
      } else {
        window.clearInterval(timer)
      }
    }
    reload()
    if (document.visibilityState === "visible") start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [reload, pollSeconds])

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    fetchFeed(nextCursor)
      .then((feed) => {
        pagedRef.current = true
        setUnread(feed.unread)
        setItems((shown) => {
          const ids = new Set(shown.map((item) => item.id))
          return [
            ...shown,
            ...feed.page.items.filter((item) => !ids.has(item.id)),
          ]
        })
        setNextCursor(feed.page.nextCursor)
      })
      .catch(() => setFailed(true))
      .finally(() => setLoadingMore(false))
  }, [nextCursor, loadingMore])

  // Shown as read at once; the server's answer and refresh() follow.
  const markRead = useCallback(
    (id: string) => {
      const item = items.find((found) => found.id === id)
      if (!item || item.read) return
      setItems((shown) =>
        shown.map((found) =>
          found.id === id ? { ...found, read: true } : found
        )
      )
      setUnread((count) => Math.max(0, count - 1))
      markNotificationRead(id).catch(reload)
    },
    [items, reload]
  )

  const markAll = useCallback(() => {
    setItems((shown) => shown.map((item) => ({ ...item, read: true })))
    setUnread(0)
    markAllNotificationsRead().catch(reload)
  }, [reload])

  return (
    <FeedContext
      value={{
        t,
        unread,
        items,
        nextCursor,
        loaded,
        failed,
        loadingMore,
        settingsHref,
        reload,
        loadMore,
        markRead,
        markAll,
      }}
    >
      {children}
    </FeedContext>
  )
}

export function useNotifications() {
  const feed = use(FeedContext)
  if (!feed) throw new Error("useNotifications needs NotificationsProvider")
  return feed
}
