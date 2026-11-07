// Settings → Plan's words (docs/plans/subscriptions.md, P4), in English as
// ICU messages (docs/plans/translations.md, G4).
const words = {
  title: "Plan",
  period: "Billing period",
  monthly: "Monthly",
  yearly: "Yearly",
  current: "Current",
  freeNote: "Free forever",
  perMonth: "{price} a month",
  perYear: "{price} a year",
  renews: "Renews {date}",
  ends: "Ends {date}",
  needsCard: "Update your card to keep Pro",
  paymentFailed: "Payment failed",
  upgrade: "Upgrade",
  manage: "Manage billing",
  // An account made by phone adds a real email before Pro.
  needsEmail: "Add your email to get Pro. Stripe sends your receipts there.",
  addEmail: {
    open: "Add email",
    title: "Add your email",
    email: "Email",
    send: "Send link",
    sent: "Check your email for the link",
  },
}

export default words
