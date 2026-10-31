import { SettingsFrame } from "@/features/dashboard/components/settings-frame"

// Settings' frame: tabs, pinned under the top bar on a phone. Each part is a
// route below it (D40).
export default async function SettingsLayout({
  params,
  children,
}: LayoutProps<"/dashboard/[businessId]/settings">) {
  const { businessId } = await params
  return <SettingsFrame businessId={businessId}>{children}</SettingsFrame>
}
