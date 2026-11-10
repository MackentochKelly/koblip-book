// The owner's Rewards page (docs/plans/rewards.md), in English as ICU
// messages (docs/plans/translations.md, G4). The rule itself in words
// ("Free Haircut", "Every 5 visits") is shared: lib/i18n/en/app.ts.
const rewards = {
  title: "Rewards",
  info: "Customers earn by booking and redeem on a later booking. Turning a reward off stops earning. Rewards already earned stay.",
  add: "Add reward",
  empty: "No rewards yet",
  new: "New reward",
  turnOn: "Turn on {name}",
  removed: "Removed",
  removeHint: "Rewards already earned stay.",
  full: "You have the most rewards a business can run. Remove one first.",
  form: {
    earn: "Customers earn with",
    earnTypes: { visit: "Visits", spend: "Amount spent" },
    goalVisit: "Visits needed",
    goalSpend: "Amount needed",
    earnServices: "Services that count",
    allServices: "All services",
    reward: "Reward",
    rewardTypes: {
      free: "Free service",
      percent: "Percent off",
      amount: "Amount off",
    },
    percent: "Percent",
    amount: "Amount",
    rewardServices: "Use on",
    more: "More options",
    count: "Bookings it covers",
    expires: "Days to use it",
    noLimit: "No limit",
    maxPerCustomer: "Times per customer",
    maxDiscount: "Most it takes off",
    minPrice: "Lowest price that counts",
    paidOnly: "Only paid bookings count",
    useNumber: "Use a number",
    usePercent: "Use a number from 1 to 100",
  },
}

export default rewards
