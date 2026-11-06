// Words only the server sends, never a page (docs/plans/translations.md,
// G4): the emails and a booking's Google Calendar event. In English as ICU
// messages; kept apart from `app` so no page carries them.
const words = {
  // The details of a booking's Google Calendar event, one line each.
  calendarEvent: {
    extras: "Extras: {extras}",
    with: "With: {name}",
    customer: "Customer: {name}",
    phone: "Phone: {phone}",
    whatsapp: "WhatsApp: {link}",
    note: "Note: {note}",
    price: "Price: {price}",
    open: "Open in Koblip Book: {link}",
  },
  // The emails Koblip Book sends: plain words and one link.
  emails: {
    verification: {
      subject: "Confirm your email",
      lead: "Tap the link to confirm your email for {app}:",
      note: "The link works for {hours, number} hours. If you didn't sign up, ignore this email.",
    },
    resetPassword: {
      subject: "Choose a new password",
      lead: "Tap the link to choose a new password for {app}:",
      note: "The link works for {minutes, number} minutes, once. If you didn't ask for it, ignore this email.",
    },
    teamCalendar: {
      subject: "Connect your Google Calendar to {businessName}",
      lead: "{businessName} asks you to connect your Google Calendar: your bookings show up there, and your busy times can't be booked.",
      note: "The link works for {days, number} days, once.",
    },
    teamInvite: {
      subject: "Join {businessName} on {app}",
      lead: "{businessName} invites you to your own space on {app}: your bookings, your hours and your profile.",
      note: "The link works for {days, number} days, once.",
    },
  },
} as const

export default words
