// The home page demo (features/demo): each visitor gets their own copy of
// the sample business.
export const DEMO_RULES = {
  // A copy, and the guest who opened it, is deleted after this (hours).
  keepHours: 24,
  // New copies one address may open per hour, so nobody fills the
  // database or runs up the assistant's bill by clearing cookies. High
  // enough for many people on one shared Wi-Fi (an office, an event).
  newPerAddressPerHour: 30,
} as const

// The demo's three screens, each at its own address (/demo/<view>).
export const DEMO_VIEWS = ["page", "dashboard", "assistant"] as const

export type DemoView = (typeof DEMO_VIEWS)[number]

// Each screen's address in the real app, for the visitor's own copy.
export type DemoPaths = Record<DemoView, string>
