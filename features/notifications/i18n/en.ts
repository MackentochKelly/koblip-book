// The bell's words (docs/plans/in-app-notifications.md, N4 and N7), in
// English as ICU messages (docs/plans/translations.md, G4).
const words = {
  bell: "Notifications",
  bellUnread:
    "{n, plural, one {Notifications, # unread} other {Notifications, # unread}}",
  title: "Notifications",
  markAll: "Mark all as read",
  settings: "Notification settings",
  today: "Today",
  earlier: "Earlier",
  unread: "Unread",
  more: "Show more",
  empty: "You're all caught up",
  failed: "Couldn't load notifications.",
  retry: "Try again",
  someone: "A customer",
  // Each kind's title, from its facts.
  kinds: {
    newBooking: "New booking: {who}",
    customerCancelled: "{who} cancelled",
    customerConfirmed: "{who} will be there",
    customerCantCome: "{who} can't make it",
    customerMoved: "{who} moved their booking",
    customerReplied: "{who} wrote on WhatsApp",
    messageFailed: "A message to {who} didn't go",
    templateApproved: "Meta approved {message}",
    templateRejected: "Meta rejected {message}",
    koblipLimitNear: "{sent} of {limit} messages used this month",
    koblipLimitReached: "Monthly message limit reached",
    connectionRenew: "Connect Koblip Chat again",
  },
  // The same names as the WhatsApp page.
  messages: {
    confirmed: "Booking confirmed",
    reminder: "Reminder",
    changed: "Booking changed",
    cancelled: "Booking cancelled",
    ownerNewBooking: "New booking alert",
    ownerCantCome: "Customer can't come alert",
    ownerCancelled: "Customer cancelled alert",
    ownerFailed: "Message failed alert",
  },
  aMessage: "a message",
  // The owner's choices screen (N7).
  choices: {
    title: "Notifications",
    groups: { bookings: "Bookings", whatsapp: "WhatsApp" },
    names: {
      newBooking: "New bookings",
      customerCancelled: "Customer cancelled",
      customerConfirmed: "Customer will be there",
      customerCantCome: "Customer can't make it",
      customerMoved: "Customer moved a booking",
      customerReplied: "Customer wrote",
      messageFailed: "Message didn't go",
      templateApproved: "Meta approved a message",
      templateRejected: "Meta rejected a message",
      koblipLimitNear: "Monthly limit almost used",
      koblipLimitReached: "Monthly limit reached",
      connectionRenew: "Connection to renew",
    },
    // Each group's ⓘ, beside its name.
    moreInfo: "More info",
    about: {
      bookings:
        "A bell alert when a customer books, confirms, can't make it, moves or cancels.",
      whatsapp:
        "A bell alert about your WhatsApp: customer replies, messages that didn't go, Meta's reviews and your monthly limit.",
    },
    failed: "Couldn't save. Try again.",
  },
} as const

export default words
