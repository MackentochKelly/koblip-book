// The owner area's frame: tabs, top bar, account menu and page titles, in
// English as ICU messages (docs/plans/translations.md, G4).
const shell = {
  nav: {
    home: "Home",
    // The home page's name on a computer; a phone keeps Home.
    dashboard: "Dashboard",
    analytics: "Analytics",
    owner: "Owner",
    bookings: "Bookings",
    customers: "Customers",
    services: "Services",
    team: "Team",
    hours: "Hours",
    automations: "Automations",
    widgets: "Widgets",
    integrations: "Integrations",
    settings: "Settings",
    assistant: "Assistant",
    details: "Details",
  },
  groups: {
    business: "Your business",
    workspace: "Workspace",
  },
  search: "Search",
  searchHint: "Search pages and actions",
  noResults: "No results",
  pages: "Pages",
  menu: "Menu",
  viewPage: "View page",
  account: "Account",
  appearance: "Appearance",
  light: "Light",
  dark: "Dark",
  device: "Device",
  language: "Language",
  // The search list's rows that pick one (Appearance: Dark).
  appearanceChoice: "Appearance: {theme}",
  languageChoice: "Language: {language}",
  signOut: "Sign out",
  // The bar over the full app for a home page demo guest.
  demo: {
    title: "This is a demo",
    text: "Look around. It resets in a day.",
    action: "Get your own page",
  },
  // Home's greeting, by the business's clock (utils/part-of-day.ts).
  greeting: {
    morning: "Good morning, {name}",
    afternoon: "Good afternoon, {name}",
    evening: "Good evening, {name}",
    // A demo guest has no name.
    noName: {
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening",
    },
  },
  // /dashboard before the first business.
  start: {
    welcome: "Welcome, {name}",
    title: "Find your business",
    hint: "Pick it on Google Maps to build your booking page.",
  },
  // The menu's business switcher and the Add business page.
  businesses: {
    title: "Businesses",
    switch: "Switch business",
    add: "Add business",
    addTitle: "Add a business",
    addHint: "Find it on Google Maps to build its booking page.",
    yours: "Your businesses",
    back: "Back",
  },
  titles: {
    checkDetails: "Check your details",
    live: "You're live",
  },
  // When an owner page fails to load.
  error: {
    title: "Something went wrong",
    description: "Try again in a few minutes.",
    retry: "Try again",
  },
} as const

export default shell
