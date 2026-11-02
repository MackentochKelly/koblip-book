// How near the screen a picture's colour wash starts drawing. Each wash uses
// one of the browser's few graphics slots (about 16 a page; past that it
// drops the oldest, the hero's moving colours), so only those near the
// screen hold one.
export const SHOWCASE_WASH_MARGIN = "200px"

// The home page's self-playing pictures ("How it works", "What you get"): how many rounds
// they play before resting (WCAG 2.2.2: nothing moves by itself for long
// without a way to stop it) and each story's timing, in ms.
export const SHOWCASE_LOOP = {
  rounds: 3,
  // Share of the picture on screen before it starts.
  inView: 0.6,
  find: {
    type: 130,
    beforeResult: 700,
    beforeTap: 1300,
    tap: 700,
    page: 3200,
  },
  check: {
    building: 1000,
    photos: 600,
    nameIn: 700,
    serviceIn: 700,
    teamIn: 700,
    beforeReady: 600,
    ready: 2800,
  },
  // The cards beside the hero on big screens (HeroSideCards).
  hero: {
    start: 1200,
    serviceIn: 600,
    beforeAsk: 700,
    thinking: 1100,
    beforeBooking: 600,
    booked: 4200,
  },
  share: {
    beforeTap: 1200,
    tap: 700,
    copied: 1100,
    beforeScroll: 900,
    scroll: 1400,
    beforePersonTap: 500,
    picked: 700,
    booked: 3200,
  },
  // Get the app's steps (dashboard): Share, Add to Home Screen, Add, and
  // the icon on the Home Screen.
  install: {
    beforeTap: 2200,
    tap: 1000,
    sheetIn: 2000,
    home: 3800,
  },
  // "Sign in with Google": the button is tapped, loads, then signed in.
  signIn: {
    beforeTap: 1200,
    tap: 700,
    loading: 1400,
    done: 3200,
  },
  // "What you get".
  // Your page: Book is tapped, then "Booked".
  page: {
    beforeTap: 1400,
    tap: 700,
    booked: 2600,
  },
  // Clients book: a service, who does it, a time, then "Confirmed".
  book: {
    start: 900,
    tap: 500,
    step: 700,
    confirmed: 2000,
  },
  // The assistant: the owner speaks, it thinks, then the answer.
  assistant: {
    listening: 1800,
    thinking: 1100,
    done: 2600,
  },
  // The calendar: the day's bookings drop in one by one.
  calendar: {
    start: 700,
    rowIn: 800,
    shown: 2600,
  },
  // Customers: a client comes back and their visits go up.
  customers: {
    before: 1400,
    shown: 2800,
  },
  // The team: each member in turn, with when they work.
  team: {
    each: 1600,
  },
  // A WhatsApp reminder comes in and the client taps Confirm.
  automations: {
    reminderIn: 900,
    beforeTap: 1200,
    tap: 700,
    confirmed: 2600,
  },
  // Reports: the week, then the month.
  reports: {
    each: 2200,
  },
} as const
