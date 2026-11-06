"use client"

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { markAllNotificationsRead, markNotificationRead } from "../api/actions"
import {
  markAllClientNotificationsRead,
  markClientNotificationRead,
} from "../api/client-actions"
import type { InAppFeed, InAppNotification } from "../types/notifications"
import { mergePage } from "../utils/notification-view"

type Feed = {
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

// Each bell's feed and read actions: the owner's, or the client's
// (docs/plans/client-account.md, D10).
const SOURCES = {
  owner: {
    feed: "/api/notifications",
    markRead: markNotificationRead,
    markAll: markAllNotificationsRead,
  },
  client: {
    feed: "/api/account/notifications",
    markRead: markClientNotificationRead,
    markAll: markAllClientNotificationsRead,
  },
} as const

export type NotificationAudience = keyof typeof SOURCES

async function fetchFeed(
  audience: NotificationAudience,
  cursor?: string
): Promise<InAppFeed> {
  const base = SOURCES[audience].feed
  const url = cursor ? `${base}?cursor=${encodeURIComponent(cursor)}` : base
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`notifications: ${res.status}`)
  return res.json()
}

// The bell's state for an app area (the owner's, or the client's with
// `audience`), once for every bell on the page (the
// phone's top bar and the computer's sidebar). The first count comes from
// the server; then the bell asks GET /api/notifications every
// `pollSeconds` while the tab is shown, and at once when it comes back
// (docs/plans/in-app-notifications.md, N-D3).
export function NotificationsProvider({
  audience = "owner",
  initialUnread,
  pollSeconds,
  settingsHref,
  children,
}: {
  audience?: NotificationAudience
  initialUnread: number
  pollSeconds: number
  settingsHref: string
  children: React.ReactNode
}) {
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
    fetchFeed(audience)
      .then((feed) => {
        setUnread(feed.unread)
        setItems((shown) => mergePage(feed.page.items, shown))
        if (!pagedRef.current) setNextCursor(feed.page.nextCursor)
        setLoaded(true)
        setFailed(false)
      })
      .catch(() => setFailed(true))
  }, [audience])

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
    fetchFeed(audience, nextCursor)
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
  }, [audience, nextCursor, loadingMore])

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
      SOURCES[audience].markRead(id).catch(reload)
    },
    [audience, items, reload]
  )

  const markAll = useCallback(() => {
    setItems((shown) => shown.map((item) => ({ ...item, read: true })))
    setUnread(0)
    SOURCES[audience].markAll().catch(reload)
  }, [audience, reload])

  return (
    <FeedContext
      value={{
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
