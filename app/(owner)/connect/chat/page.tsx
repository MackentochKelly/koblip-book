import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { ConnectDone } from "@/features/dashboard/components/connect-done"
import {
  CHAT_CONNECT_CHANNEL,
  CHAT_CONNECT_RESULTS,
  type ChatConnectMessage,
  type ChatConnectResult,
} from "@/types/chat-connect"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.integrations")
  return { title: t("koblipChat.name") }
}

type Props = {
  searchParams: Promise<{ businessId?: string; for?: string; result?: string }>
}

// Where the Koblip Chat window ends (app/api/chat/callback sends it here).
// Opened as a full page, it goes back to Integrations, or to the admin area
// for Koblip's own connection.
export default async function ChatConnectDonePage({ searchParams }: Props) {
  const { businessId = "", for: account, result } = await searchParams
  const koblip = account === "koblip"
  const known = CHAT_CONNECT_RESULTS.find((value) => value === result) ?? ("failed" satisfies ChatConnectResult)
  const message: ChatConnectMessage = { businessId, koblip, result: known }
  const back = koblip
    ? `/admin/whatsapp/koblip-number?chat=${known}`
    : businessId
      ? `/dashboard/${encodeURIComponent(businessId)}/integrations?chat=${known}`
      : "/dashboard"
  return <ConnectDone channel={CHAT_CONNECT_CHANNEL} message={message} back={back} />
}
