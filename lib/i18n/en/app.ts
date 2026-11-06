// Words shared by every area, in English as ICU messages
// (docs/plans/translations.md, G4): the apps Koblip Book works with (each
// one's name and what Koblip does with it, for the dashboard's
// Integrations page and the home page's apps), and the shared parts in
// components/.
const words = {
  muse: {
    name: "Muse by Meta",
    description:
      "Meta's AI builds your page from your listing and runs your assistant, by text or voice.",
  },
  googleMaps: {
    name: "Google Maps",
    description:
      "Your page starts from your Google Maps listing: name, address, hours, photos and rating.",
  },
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
    description: "See which Facebook and Instagram ads bring you bookings.",
  },
  googleAnalytics: {
    name: "Google Analytics",
    description: "See who visits your booking page and how many of them book.",
  },
  koblipChat: {
    name: "Koblip Chat",
    description:
      "WhatsApp reminders and broadcasts through Koblip Chat, which holds your official Meta connection. Replies arrive in your Koblip Chat inbox.",
  },
  // components/theme-toggle.tsx
  themeToggle: {
    label: "Light or dark mode",
  },
  // components/language-menu.tsx (each language is named in itself).
  languageMenu: {
    label: "Language",
  },
  // components/phone-input.tsx: the country picker.
  phoneInput: {
    country: "Country",
    search: "Search country…",
    empty: "No country found.",
  },
  // A length of time ("1 h 30 min").
  duration: {
    minutes: "{minutes, number} min",
    hours: "{hours, number} h",
    hoursMinutes: "{hours, number} h {minutes, number} min",
  },
  // A public page that can't load (app/(public)/b/[slug]/error.tsx).
  pageError: {
    title: "This page is not available right now",
    text: "Try again in a few minutes.",
    retry: "Try again",
  },
  // A feature the business's plan doesn't include (components/plan-locked.tsx).
  planLocked: {
    title: "Part of {plan}",
    plans: { free: "Free", pro: "Pro" },
    seePlans: "See plans",
  },
  // The shadcn parts in components/ui: words people see or hear (screen
  // readers included). A part that takes a word as a prop uses its word
  // here when the caller gives none.
  ui: {
    loading: "Loading",
    close: "Close",
    // sidebar.tsx
    sidebar: "Sidebar",
    sidebarDescription: "Displays the mobile sidebar.",
    toggleSidebar: "Toggle Sidebar",
    // carousel.tsx: what a screen reader calls the carousel and each slide.
    carousel: "carousel",
    slide: "slide",
    previousSlide: "Previous slide",
    nextSlide: "Next slide",
    // pagination.tsx
    pagination: "pagination",
    previous: "Previous",
    next: "Next",
    previousPage: "Go to previous page",
    nextPage: "Go to next page",
    morePages: "More pages",
    // message-scroller.tsx
    scrollToEnd: "Scroll to end",
    scrollToStart: "Scroll to start",
    // command.tsx: CommandDialog's hidden title and description.
    commandTitle: "Command Palette",
    commandDescription: "Search for a command to run...",
    // audio-player.tsx
    play: "Play",
    pause: "Pause",
    playbackSpeed: "Playback speed",
    normalSpeed: "Normal",
    playbackSpeedControls: "Playback speed controls",
    // voice-picker.tsx
    selectVoice: "Select a voice...",
    searchVoices: "Search voices...",
    noVoice: "No voice found.",
  },
} as const

export default words
