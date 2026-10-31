// The Integrations page: the apps a business connects to Koblip Book.
const integrations = {
  messaging: "Messaging",
  calendar: "Calendar",
  payments: "Payments",
  tracking: "Tracking",
  social: "Get found",
  reviews: "Reviews",
  soon: "Coming soon",
  about: (name: string) => `About ${name}`,
  whatsapp: {
    name: "WhatsApp",
    description:
      "Official WhatsApp Business, straight from Meta. Send booking reminders and broadcasts from your own business number.",
  },
  sms: {
    name: "Twilio SMS",
    description:
      "Booking confirmations and reminders by text message through Twilio, for customers without WhatsApp.",
  },
  email: {
    name: "Email",
    description:
      "Booking confirmations, reminders and changes sent to your customers by email.",
  },
  instagram: {
    name: "Instagram",
    description:
      "A Book button on your Instagram profile, so followers book in a few taps.",
  },
  facebook: {
    name: "Facebook",
    description:
      "A Book button on your Facebook Page, so visitors book without leaving.",
  },
  googleBusiness: {
    name: "Google Business Profile",
    description:
      "A Book button on Google Search and Maps, where customers find you.",
  },
  googleReviews: {
    name: "Google reviews",
    description:
      "After each visit, ask customers for a Google review to win more bookings.",
  },
  googleCalendar: {
    name: "Google Calendar",
    description:
      "Your bookings in your Google Calendar, kept up to date as they change.",
  },
  appleCalendar: {
    name: "Apple Calendar",
    description:
      "Your bookings in Apple Calendar on iPhone, iPad and Mac, kept up to date.",
  },
  outlook: {
    name: "Outlook Calendar",
    description:
      "Your bookings in your Outlook calendar, kept up to date as they change.",
  },
  stripe: {
    name: "Stripe",
    description:
      "Take deposits or full payment when customers book, so fewer skip their visit.",
  },
  metaPixel: {
    name: "Meta Pixel",
    description:
      "See which Facebook and Instagram ads bring you bookings.",
  },
  googleAnalytics: {
    name: "Google Analytics",
    description:
      "See who visits your booking page and how many of them book.",
  },
  koblipChat: {
    name: "Koblip Chat",
    description:
      "WhatsApp reminders and broadcasts through Koblip Chat, which holds your official Meta connection. Replies arrive in your Koblip Chat inbox.",
    connect: "Connect",
    connected: "Connected",
    disconnect: "Disconnect",
    disconnected: "Koblip Chat disconnected.",
    workspace: (name: string) => `Connected to ${name}`,
    reconnect: "Reconnect",
    reconnectHint: "The connection stopped. Connect again.",
    connectedToast: "Koblip Chat connected.",
    failed: "Couldn't connect Koblip Chat. Try again.",
    messages: {
      noNumber: "Add a WhatsApp number in Koblip Chat to send messages.",
      settingUp: "Setting up your WhatsApp messages…",
      notSubmitted: "Submit your WhatsApp messages to Meta in Auto messages.",
      waiting: "Your WhatsApp messages are waiting for Meta's approval.",
      rejected: "Meta didn't approve a WhatsApp message. Check it in Koblip Chat.",
    },
  },
}

export default integrations
