import { getEmailActivity } from "@/features/admin/api/email"
import { EmailActivity } from "@/features/admin/components/email-activity"
import { emailFilterFrom } from "@/lib/email-activity-filter"
import { EMAIL_KINDS } from "@/lib/email-rules"

// Email → Emails (docs/plans/email.md, EM-11): every email, filtered from
// the address.
export default async function AdminEmailPage({ searchParams }: PageProps<"/admin/email">) {
  const filter = emailFilterFrom(await searchParams, EMAIL_KINDS)
  return <EmailActivity rows={await getEmailActivity(filter)} filter={filter} />
}
