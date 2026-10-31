export const BOOKING_RULES = {
  slotStepMinutes: 15,
  daysAhead: 30,
  minimumNoticeMinutes: 60,
  serviceMinutes: [
    15, 20, 30, 40, 45, 60, 75, 90, 120, 150, 180, 240,
  ],
  maxServices: 50,
  maxTeam: 20,
  maxSeats: 20,
  maxServiceName: 80,
  maxTeamName: 80,
  maxTeamDescription: 120,
  maxEmail: 254,
  maxServiceDescription: 300,
  maxBusinessName: 120,
  maxBusinessAddress: 300,
  maxBusinessDescription: 1000,
  maxCustomerName: 80,
  maxPriceMinor: 10_000_000,
  maxNote: 500,
  maxHoursRows: 14,
  ownerDaysBack: 30,
  ownerDaysAhead: 365,
  maxAddonGroups: 30,
  maxAddonOptions: 20,
  maxAddonName: 80,
  maxAddonDescription: 200,
  maxAddonPrompt: 120,
  addonMinutes: [0, 5, 10, 15, 20, 30, 45, 60, 90],
  // The open bookings screen looks for new bookings this often (seconds),
  // so one made on the booking page shows up without reloading.
  ownerRefreshSeconds: 5,
  // How many days ahead the owner's counts and Analytics chart cover: today
  // and the 13 after it (the chart's 14 days view).
  chartDays: 14,
  // How many days back the Analytics page looks: today and the 29 before.
  analyticsDays: 30,
} as const

export const PHONE_PATTERN = /^\+?[\d\s().-]{7,25}$/

// One address: something@something.something, no spaces.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
