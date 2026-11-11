import type {
  EmailDelivery,
  EmailKind,
  EmailSendReason,
  EmailSendState,
} from "@/lib/email-rules"

// One email in a history list (docs/plans/email.md, EM-10, EM-11): which,
// to whom, when (sent, or when it goes), and what became of it. The admin's
// list also names the business and shows its time zone.
export type EmailActivityRow = {
  id: string
  kind: EmailKind
  email: string
  customerName: string | null
  businessName: string | null
  timeZone: string | null
  at: string
  state: EmailSendState
  reason: EmailSendReason | null
  delivery: EmailDelivery | null
}

// The history's filters, kept in the address (?email=&state=&q=).
export type EmailActivityFilter = {
  kind?: EmailKind
  state?: EmailActivityState
  // Customer name, email address or business name.
  search?: string
}

export type EmailActivityState = Exclude<EmailSendState, "sending">
