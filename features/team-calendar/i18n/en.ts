// A team member's Google Calendar link page (G5 in
// docs/plans/google-calendar.md), in English as ICU messages
// (docs/plans/translations.md, G4).
const words = {
  title: "Connect your Google Calendar",
  intro:
    "Your {business} bookings go into your calendar, and your busy times can't be booked.",
  connect: "Connect Google Calendar",
  expired: {
    title: "This link doesn't work anymore",
    text: "Ask for a new link.",
  },
  connected: {
    title: "Google Calendar connected",
    text: "Your bookings will show in your calendar.",
  },
  denied: {
    title: "Not connected",
    text: "Allow the Koblip Book calendar, then open your link again.",
  },
  failed: {
    title: "Couldn't connect",
    text: "Open your link again.",
  },
} as const

export default words
