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
    clientBooked: "Booked: {service}, {when}",
    clientMoved: "{service} moved to {when}",
    clientCancelled: "{service} on {when} was cancelled",
    clientReminder: "Reminder: {service}, {when}",
    clientReviewAsk: "How was {service}? Rate your visit",
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
    groups: { bookings: "Bookings", whatsapp: "WhatsApp", visits: "Bookings" },
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
      clientBooked: "Booked for you",
      clientMoved: "Booking moved",
      clientCancelled: "Booking cancelled",
      clientReminder: "Reminder before a visit",
      clientReviewAsk: "Rate a visit",
    },
    // How the client's visit reminders reach them (client account D16).
    remindBy: "Remind me by",
    channels: {
      whatsapp: "WhatsApp",
      email: "Email",
      bell: "Only here",
    },
    channelHelp: {
      whatsapp: "If you agree when you book",
      email: "To {email}",
      bell: "No messages",
    },
    noEmail: "Your account has no email",
    // Each group's ⓘ, beside its name.
    moreInfo: "More info",
    about: {
      bookings:
        "A bell alert when a customer books, confirms, can't make it, moves or cancels.",
      whatsapp:
        "A bell alert about your WhatsApp: customer replies, messages that didn't go, Meta's reviews and your monthly limit.",
      visits:
        "A bell alert when a business books, moves or cancels your visit, a reminder before it, and a nudge to rate it after.",
    },
    failed: "Couldn't save. Try again.",
  },
} as const

export default words
