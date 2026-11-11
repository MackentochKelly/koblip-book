import { EmailFrame } from "@/features/admin/components/email-frame"

// The admin's Email section: tabs, pinned under the top bar on a phone. Each
// part is a route below it (docs/plans/email.md, EM-11).
export default function AdminEmailLayout({ children }: { children: React.ReactNode }) {
  return <EmailFrame>{children}</EmailFrame>
}
