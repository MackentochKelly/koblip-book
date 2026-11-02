// The owner area's frame: tabs, top bar, account menu and page titles.
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
  signOut: "Sign out",
  // The bar over the full app for a home page demo guest.
  demo: {
    title: "This is a demo",
    text: "Look around. It resets in a day.",
    action: "Get your own page",
  },
  // Home's greeting, by the business's clock; no name for a demo guest.
  greeting: {
    eveningFrom: 18,
    morning: (name?: string) =>
      name ? `Good morning, ${name}` : "Good morning",
    afternoon: (name?: string) =>
      name ? `Good afternoon, ${name}` : "Good afternoon",
    evening: (name?: string) =>
      name ? `Good evening, ${name}` : "Good evening",
  },
  // /dashboard before the first business.
  start: {
    welcome: (name: string) => `Welcome, ${name}`,
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
}

export default shell
