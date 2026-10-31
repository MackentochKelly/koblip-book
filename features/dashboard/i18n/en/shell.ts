// The owner area's frame: tabs, top bar, account menu and page titles.
const shell = {
  nav: {
    home: "Home",
    // The home page's name on a computer; a phone keeps Home.
    dashboard: "Dashboard",
    owner: "Owner",
    bookings: "Bookings",
    customers: "Customers",
    services: "Services",
    team: "Team",
    hours: "Hours",
    automations: "Automations",
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
  // /dashboard before the first business.
  start: {
    welcome: (name: string) => `Welcome, ${name}`,
    title: "Find your business",
    hint: "Pick it on Google Maps to build your booking page.",
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
