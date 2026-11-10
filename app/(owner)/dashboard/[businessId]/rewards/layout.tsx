import { RewardsFrame } from "@/features/dashboard/components/rewards-frame"

// The reward rules and their activity, each a part with its own route
// (docs/plans/rewards.md, RW-9).
export default async function RewardsLayout({
  params,
  children,
}: LayoutProps<"/dashboard/[businessId]/rewards">) {
  const { businessId } = await params
  return <RewardsFrame businessId={businessId}>{children}</RewardsFrame>
}
