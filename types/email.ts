import type {
  BookingEmail,
  EmailDelivery,
  EmailSendReason,
  EmailSendState,
} from "@/lib/email-rules"

// One booking email in a history list (docs/plans/email.md, EM-10): which,
// to whom, when (sent, or when it goes), and what became of it.
export type EmailActivityRow = {
  id: string
  kind: BookingEmail
  email: string
  customerName: string | null
  at: string
  state: EmailSendState
  reason: EmailSendReason | null
  delivery: EmailDelivery | null
}

// The history's filters, kept in the address (?email=&state=&q=).
export type EmailActivityFilter = {
  kind?: BookingEmail
  state?: EmailActivityState
  // Customer name or email address.
  search?: string
}

export type EmailActivityState = Exclude<EmailSendState, "sending">
