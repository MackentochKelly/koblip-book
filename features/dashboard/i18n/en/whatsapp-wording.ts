// Book's own wording for its WhatsApp messages, in English as ICU messages
// (docs/plans/translations.md, G8): the booking messages (Meta templates),
// their buttons and sample values, the words for a value a booking lacks,
// the thank-you, and the Welcome flow. {name}, {service}… are the message's
// own fields and stay as they are in every language. Every language reads
// them as the app's words (features/dashboard/api/message-words.ts): Spanish
// is the hand-written text Meta approved, kept as Edited; Portuguese and
// French are Google's.
const wording = {
  messages: {
    confirmed: {
      header: "Booking confirmed",
      body: "Hi {name}, your {service} at {business} is booked for {date} at {time}. We look forward to seeing you then!",
    },
    reminder: {
      header: "Appointment reminder",
      body: "Hi {name}, a reminder of your {service} at {business} on {date} at {time}. See you soon!",
    },
    changed: {
      header: "Booking changed",
      body: "Hi {name}, your {service} at {business} has been moved to {date} at {time}. We look forward to seeing you then!",
    },
    cancelled: {
      header: "Booking cancelled",
      body: "Hi {name}, your {service} at {business} on {date} at {time} has been cancelled. We hope to see you soon.",
    },
    ownerNewBooking: {
      header: "New booking",
      body: "New booking from {name}: {service} on {date} at {time}. Phone: {phone}. Open Koblip Book for details.",
    },
    ownerCantCome: {
      header: "Customer can't come",
      body: "Your customer {name} can't make it to {service} on {date} at {time}. The booking is still on. Phone: {phone}. Open Koblip Book for details.",
    },
    ownerCancelled: {
      header: "Customer cancelled",
      body: "Your customer {name} cancelled {service} on {date} at {time}, and the time is free again. Phone: {phone}. Open Koblip Book for details.",
    },
    ownerFailed: {
      header: "Message not sent",
      body: "A WhatsApp message to {name} about {service} on {date} at {time} was not sent. Phone: {phone}. Open Koblip Book to see why.",
    },
  },
  // Every message's footer.
  footer: "Reply here to talk to us",
  // The quick-reply buttons, at most 25 letters each.
  buttons: { confirm: "I'll be there", cantCome: "Can't make it", ok: "OK" },
  // A booking without a team member or a price still reads as a sentence.
  missing: { teamMember: "our team", free: "free", price: "to be confirmed" },
  // The short thank-you after a customer taps a button.
  thankYou: "Thanks, {name}! {business} got your answer.",
  // Sample values Meta reviews a template with, as a customer in the
  // language would read them. The business's name is the same in every
  // language (booking-templates.ts) and the length is the app's own words.
  examples: {
    name: "Alex",
    service: "Haircut",
    date: "Friday, May 8",
    time: "3:30 PM",
    teamMember: "Sam",
    price: "$35.00",
    address: "123 Main Street",
    phone: "+1 555 123 4567",
  },
  // The Welcome flow: Book's answer to a customer's first message.
  welcome: {
    body: "Thanks for writing to {business}! Choose an option to get help faster.",
    handoffReply: "Got it, someone will answer you soon.",
    servicesIntro: "Choose a service to book.",
    buttons: { bookingLink: "Book now", servicesList: "Our services", handoff: "Talk to us" },
  },
} as const

export default wording
