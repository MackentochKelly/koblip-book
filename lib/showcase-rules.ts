// How near the screen a picture's colour wash starts drawing. Each wash uses
// one of the browser's few graphics slots (about 16 a page; past that it
// drops the oldest, the hero's moving colours), so only those near the
// screen hold one.
export const SHOWCASE_WASH_MARGIN = "200px"

// The home page's self-playing pictures ("How it works"): how many rounds
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
    hoursIn: 700,
    serviceIn: 700,
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
  // "Get booked": today's list, and a new booking coming in on top.
  booked: {
    before: 1400,
    shown: 3600,
  },
} as const
