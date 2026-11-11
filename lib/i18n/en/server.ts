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
  // The emails Koblip Book sends (lib/email-layout.ts): a title, one short
  // paragraph, one button and a note.
  emails: {
    verification: {
      subject: "Confirm your email",
      lead: "Confirm your email to finish signing up for {app}.",
      button: "Confirm email",
      note: "The link works for {hours, number} hours. If you didn't sign up, ignore this email.",
    },
    resetPassword: {
      subject: "Choose a new password",
      lead: "Choose a new password for your {app} account.",
      button: "Choose password",
      note: "The link works for {minutes, number} minutes, once. If you didn't ask for it, ignore this email.",
    },
    teamCalendar: {
      subject: "Connect your Google Calendar to {businessName}",
      lead: "{businessName} asks you to connect your Google Calendar: your bookings show up there, and your busy times can't be booked.",
      button: "Connect Google Calendar",
      note: "The link works for {days, number} days, once.",
    },
    teamInvite: {
      subject: "Join {businessName} on {app}",
      lead: "{businessName} invites you to your own space on {app}: your bookings, your hours and your profile.",
      button: "Accept invite",
      note: "The link works for {days, number} days, once.",
    },
    // App subscriptions (docs/plans/subscriptions.md, P6), to the owner.
    paymentFailed: {
      subject: "Pro payment for {businessName} didn't go through",
      lead: "Stripe couldn't charge your card for {businessName}'s Pro plan. Update your card to keep Pro.",
      button: "Update card",
      note: "Stripe tries again over the next few days. If it still can't, {businessName} goes back to Free. Nothing is deleted.",
    },
    backToFree: {
      subject: "{businessName} is back on Free",
      lead: "{businessName}'s Pro plan has ended, so it's on Free now.",
      button: "Upgrade",
      note: "Nothing was deleted. Your Pro settings come back when you upgrade.",
    },
    // A booking's emails (EM-D6): the customer's four and the owner's three.
    // The booking's own details go in the lines below the lead.
    booking: {
      confirmed: {
        subject: "Booking confirmed: {service} at {business}",
        title: "Booking confirmed",
        lead: "Hi {name}, your booking at {business} is confirmed. We look forward to seeing you!",
      },
      reminder: {
        subject: "Reminder: {service} at {business}",
        title: "Booking reminder",
        lead: "Hi {name}, a reminder of your booking at {business}. See you soon!",
      },
      changed: {
        subject: "Booking changed: {service} at {business}",
        title: "Booking changed",
        lead: "Hi {name}, your booking at {business} has a new time.",
      },
      cancelled: {
        subject: "Booking cancelled: {service} at {business}",
        title: "Booking cancelled",
        lead: "Hi {name}, your booking at {business} has been cancelled. We hope to see you soon.",
      },
      ownerNewBooking: {
        subject: "New booking: {name}, {service}",
        title: "New booking",
        lead: "{name} booked {service}.",
      },
      ownerCantCome: {
        subject: "{name} can't come: {service}",
        title: "Customer can't come",
        lead: "{name} can't make it. The booking is still on.",
      },
      ownerCancelled: {
        subject: "{name} cancelled: {service}",
        title: "Customer cancelled",
        lead: "{name} cancelled, and the time is free again.",
      },
      lines: {
        service: "Service",
        when: "When",
        teamMember: "With",
        address: "Where",
        price: "Price",
        customer: "Customer",
        phone: "Phone",
        email: "Email",
      },
      when: "{date} at {time}",
      seeBooking: "See booking",
      bookAgain: "Book again",
      openBookings: "Open bookings",
      calendar: "Add it to your calendar with the attached file.",
      customerFooter: "You get this email because you booked with {business}.",
      ownerFooter: "You get this email because you run {business} on {app}.",
      stop: "Stop emails",
    },
  },
} as const

export default words
