import type { NextRequest } from "next/server"

import { handleGoogleNotification } from "@/lib/google-calendar-channels"

// Google Calendar's push notifications (developers.google.com/workspace/calendar/api/guides/push):
// a POST with no body when a watched calendar changes. Only a channel Book
// made, with its token, counts. Always answered 200 straight away: the busy
// times are read after, and anything else would only make Google retry.
export async function POST(request: NextRequest) {
  try {
    await handleGoogleNotification({
      channelId: request.headers.get("x-goog-channel-id"),
      token: request.headers.get("x-goog-channel-token"),
      resourceId: request.headers.get("x-goog-resource-id"),
      state: request.headers.get("x-goog-resource-state"),
    })
  } catch (error) {
    console.error(error)
  }
  return new Response(null, { status: 200 })
}
