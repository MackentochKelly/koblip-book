// The owner's Email page (docs/plans/email.md, EM-10): one switch per
// booking email, and the history. In English as ICU messages
// (docs/plans/translations.md, G4).
const words = {
  emails: "Emails",
  groups: { customer: "To customers", owner: "To you" },
  about: {
    customer: "Sent to the email on the booking. Reminders go at your reminder times, by email when WhatsApp can't reach the customer.",
    owner: "Sent to your account's email when a customer books, can't come or cancels.",
  },
  moreInfo: "More info",
  names: {
    bookingConfirmed: "Booking confirmed",
    clientReminder: "Reminder",
    bookingChanged: "Booking changed",
    bookingCancelled: "Booking cancelled",
    ownerNewBooking: "New booking",
    ownerCantCome: "Customer can't come",
    ownerCancelled: "Customer cancelled",
  },
  failed: "Couldn't save. Try again.",
  history: "History",
  noHistory: "No emails yet",
  openBookings: "Open bookings",
  search: "Name or email…",
  searchLabel: "Search by customer name or email",
  emailFilter: "Email",
  stateFilter: "Status",
  filters: "Filters",
  showResults: "Show results",
  allEmails: "All emails",
  allStates: "Any status",
  noneFound: "No emails match",
  clearFilters: "Clear filters",
  states: {
    pending: "Scheduled",
    sending: "Sending",
    sent: "Sent",
    failed: "Failed",
    skipped: "Not sent",
    delivered: "Delivered",
    delayed: "Delayed",
    bounced: "Bounced",
    complained: "Marked as spam",
    rejected: "Rejected",
  },
  // Why an email was not sent.
  reasons: {
    blocked: "Address stopped emails",
    notSetUp: "Email not set up",
    sendFailed: "Couldn't send",
    cancelled: "Booking cancelled",
    moved: "Booking moved",
    late: "Too late",
    interrupted: "Stopped midway",
    notTold: "Customer not told yet",
    turnedOff: "Email turned off",
    notOnPlan: "Not on your plan",
  },
} as const

export default words
