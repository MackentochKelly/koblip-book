import { getEmailSetup } from "@/features/admin/api/email"
import { getWhatsappRules } from "@/features/admin/api/whatsapp-rules"
import { EmailSetup } from "@/features/admin/components/email-setup"
import { WhatsappRules } from "@/features/admin/components/whatsapp-rules"
import { EMAIL_RULE_GROUPS } from "@/features/admin/utils/whatsapp-rules"

// Email → Rules (docs/plans/email.md, EM-11): how sending is set up, then
// the rules booking emails follow, edited as on WhatsApp → Rules.
export default async function AdminEmailRulesPage() {
  const [setup, rules] = await Promise.all([getEmailSetup(), getWhatsappRules()])
  return (
    <div className="flex flex-col gap-6">
      <EmailSetup setup={setup} />
      <WhatsappRules rules={rules} groups={EMAIL_RULE_GROUPS} />
    </div>
  )
}
