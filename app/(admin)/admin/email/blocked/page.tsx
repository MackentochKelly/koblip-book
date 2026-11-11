import { getEmailBlocks } from "@/features/admin/api/email"
import { EmailBlocks } from "@/features/admin/components/email-blocks"

// Email → Blocked (docs/plans/email.md, EM-11).
export default async function AdminEmailBlockedPage({
  searchParams,
}: PageProps<"/admin/email/blocked">) {
  const { q } = await searchParams
  const search = typeof q === "string" ? q.trim() || undefined : undefined
  return <EmailBlocks rows={await getEmailBlocks(search)} search={search} />
}
