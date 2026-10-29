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
} as const
