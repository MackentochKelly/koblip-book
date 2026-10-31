import type { Metadata } from "next"

import { ConnectDone } from "@/features/dashboard/components/connect-done"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import {
  GOOGLE_CONNECT_CHANNEL,
  GOOGLE_CONNECT_RESULTS,
  type GoogleConnectMessage,
  type GoogleConnectResult,
} from "@/types/google-calendar-connect"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).integrations.googleCalendar.name }
}

type Props = {
  searchParams: Promise<{ businessId?: string; result?: string }>
}

// Where the Google window ends (app/api/google-calendar/callback sends it
// here). Opened as a full page, it goes back to Integrations.
export default async function GoogleCalendarConnectDonePage({ searchParams }: Props) {
  const { businessId = "", result } = await searchParams
  const known =
    GOOGLE_CONNECT_RESULTS.find((value) => value === result) ?? ("failed" satisfies GoogleConnectResult)
  const message: GoogleConnectMessage = { businessId, result: known }
  const back = businessId
    ? `/dashboard/${encodeURIComponent(businessId)}/integrations?google=${known}`
    : "/dashboard"
  return <ConnectDone channel={GOOGLE_CONNECT_CHANNEL} message={message} back={back} />
}
