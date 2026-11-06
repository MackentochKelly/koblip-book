// Every feature a plan can include, and the lowest plan that has it by
// default (docs/plans/subscriptions.md, S9 and S10). The admin changes a
// feature's plan in Admin → Plans (lib/plan-access.ts); a higher plan always
// has everything a lower one has.

// Lowest first.
export const PLANS = ["free", "pro"] as const
export type Plan = (typeof PLANS)[number]

export const PLAN_FEATURE_GROUPS = [
  "bookingPage",
  "dashboard",
  "assistant",
  "whatsapp",
  "team",
  "integrations",
] as const
export type PlanFeatureGroup = (typeof PLAN_FEATURE_GROUPS)[number]

type PlanFeature = {
  group: PlanFeatureGroup
  // "soon": listed as "Coming soon" in the app, not built yet.
  status: "live" | "soon"
  defaultPlan: Plan
}

// In the order Admin → Plans shows them, by group.
export const PLAN_FEATURES = {
  // The customer's side.
  bookingPage: { group: "bookingPage", status: "live", defaultPlan: "free" },
  onlineBooking: { group: "bookingPage", status: "live", defaultPlan: "free" },
  teamProfiles: { group: "bookingPage", status: "live", defaultPlan: "free" },
  portfolio: { group: "bookingPage", status: "live", defaultPlan: "free" },
  policies: { group: "bookingPage", status: "live", defaultPlan: "free" },
  pageThemes: { group: "bookingPage", status: "live", defaultPlan: "free" },
  pageLanguages: { group: "bookingPage", status: "live", defaultPlan: "free" },
  myBookings: { group: "bookingPage", status: "live", defaultPlan: "free" },
  onlinePayments: { group: "bookingPage", status: "soon", defaultPlan: "pro" },
  // The owner's dashboard.
  bookings: { group: "dashboard", status: "live", defaultPlan: "free" },
  customers: { group: "dashboard", status: "live", defaultPlan: "free" },
  services: { group: "dashboard", status: "live", defaultPlan: "free" },
  analytics: { group: "dashboard", status: "live", defaultPlan: "free" },
  widgets: { group: "dashboard", status: "live", defaultPlan: "free" },
  inAppNotifications: { group: "dashboard", status: "live", defaultPlan: "free" },
  multipleBusinesses: { group: "dashboard", status: "live", defaultPlan: "free" },
  // The AI assistant.
  assistantChat: { group: "assistant", status: "live", defaultPlan: "free" },
  assistantVoice: { group: "assistant", status: "live", defaultPlan: "free" },
  aiWriting: { group: "assistant", status: "live", defaultPlan: "free" },
  // WhatsApp, through Koblip Chat.
  whatsappMessages: { group: "whatsapp", status: "live", defaultPlan: "free" },
  whatsappReminders: { group: "whatsapp", status: "live", defaultPlan: "free" },
  whatsappAutomations: { group: "whatsapp", status: "live", defaultPlan: "free" },
  whatsappOwnNumber: { group: "whatsapp", status: "live", defaultPlan: "free" },
  whatsappOwnerAlerts: { group: "whatsapp", status: "live", defaultPlan: "free" },
  // The team.
  teamMembers: { group: "team", status: "live", defaultPlan: "free" },
  teamAccounts: { group: "team", status: "live", defaultPlan: "free" },
  // Other apps.
  googleMapsImport: { group: "integrations", status: "live", defaultPlan: "free" },
  googleCalendar: { group: "integrations", status: "live", defaultPlan: "free" },
  smsReminders: { group: "integrations", status: "soon", defaultPlan: "pro" },
  emailReminders: { group: "integrations", status: "soon", defaultPlan: "pro" },
  instagramButton: { group: "integrations", status: "soon", defaultPlan: "pro" },
  facebookButton: { group: "integrations", status: "soon", defaultPlan: "pro" },
  googleBusinessProfile: { group: "integrations", status: "soon", defaultPlan: "pro" },
  googleReviewRequests: { group: "integrations", status: "soon", defaultPlan: "pro" },
  appleCalendar: { group: "integrations", status: "soon", defaultPlan: "pro" },
  outlookCalendar: { group: "integrations", status: "soon", defaultPlan: "pro" },
  metaPixel: { group: "integrations", status: "soon", defaultPlan: "pro" },
  googleAnalytics: { group: "integrations", status: "soon", defaultPlan: "pro" },
} as const satisfies Record<string, PlanFeature>

export type PlanFeatureKey = keyof typeof PLAN_FEATURES

// The built features that already ask for their plan before they run
// (hasFeature, ownerHasFeature: lib/plan-access.ts). Admin → Plans lets
// the admin move only these and the "soon" ones (which will check when they
// are built); plan-checks.test.ts keeps this list and the code in step.
export const PLAN_CHECKED_FEATURES: readonly PlanFeatureKey[] = [
  "analytics",
  "widgets",
  "pageThemes",
  "multipleBusinesses",
  "assistantChat",
  "assistantVoice",
  "aiWriting",
  "whatsappAutomations",
  "whatsappOwnNumber",
  "teamAccounts",
  "googleCalendar",
]

// Whether Admin → Plans may move this feature to another plan.
export function planMovable(key: PlanFeatureKey): boolean {
  return PLAN_FEATURES[key].status === "soon" || PLAN_CHECKED_FEATURES.includes(key)
}

export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && (PLANS as readonly string[]).includes(value)
}

export function isPlanFeature(value: unknown): value is PlanFeatureKey {
  return typeof value === "string" && Object.hasOwn(PLAN_FEATURES, value)
}

// Whether `plan` includes a feature whose lowest plan is `lowest`.
export function planIncludes(plan: Plan, lowest: Plan): boolean {
  return PLANS.indexOf(plan) >= PLANS.indexOf(lowest)
}
