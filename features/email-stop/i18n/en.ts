// The "Stop emails" page a customer email's link opens (docs/plans/email.md,
// EM-D10), in English as ICU messages (docs/plans/translations.md, G4).
const words = {
  title: "Stop emails from {business}?",
  text: "{email} won't get emails from {business} anymore.",
  stop: "Stop emails",
  stopped: {
    title: "Emails stopped",
    text: "{email} won't get emails from {business} anymore.",
  },
  expired: {
    title: "This link doesn't work",
    text: "Open the link in your latest email.",
  },
} as const

export default words
