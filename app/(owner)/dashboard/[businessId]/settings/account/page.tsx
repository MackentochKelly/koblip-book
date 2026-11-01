import type { Metadata } from "next"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { AccountSection } from "@/features/dashboard/components/account-section"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import { requireAccount } from "@/lib/dal"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).settings.parts.account }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function AccountPage({ params }: Props) {
  const { businessId } = await params
  const returnTo = `/dashboard/${businessId}/settings/account`
  const [owner] = await Promise.all([
    requireAccount(returnTo),
    getOwnerBusiness(businessId),
  ])
  return <AccountSection email={owner.email} returnTo={returnTo} />
}
