// Home's widgets: editing them on Home and the Widgets page.
const widgets = {
  title: "Widgets",
  names: {
    stats: "Numbers",
    today: "Assistant",
    bookings: "Bookings",
    next: "Next booking",
    chart: "Coming up",
    newCustomers: "New customers",
    share: "Share your page",
    install: "Get the app",
  },
  edit: "Edit widgets",
  done: "Done",
  add: "Add widget",
  remove: (name: string) => `Remove ${name}`,
  move: (name: string) => `Move ${name}`,
  show: (name: string) => `Show ${name} on Home`,
  noneShown: "No widgets on Home",
  savedFor: "Layout saved for",
  everyDevice: "All your devices",
  thisDevice: "This device only",
  failed: "Couldn't save. Try again.",
  // Read to screen readers while a widget is moved with the keyboard.
  instructions:
    "To move a widget, press Space. Use the arrow keys to move it, Space to drop it, or Escape to cancel.",
  picked: (name: string) => `Picked up ${name}.`,
  movedTo: (name: string, position: number, total: number) =>
    `${name} moved to position ${position} of ${total}.`,
  dropped: (name: string, position: number, total: number) =>
    `${name} dropped at position ${position} of ${total}.`,
  cancelled: (name: string) => `Moving ${name} cancelled.`,
  // The widgets' own words.
  noNext: "No bookings coming up",
  noNewCustomers: "No new customers this week",
  firstVisit: "First visit",
  viewAll: "View all",
  installLead: "Open your bookings in one tap from your Home Screen.",
  installElsewhere:
    "Open this page on your phone to add it to your Home Screen.",
  installButton: "Install app",
  // The iPhone's own button names, in the order they're tapped.
  installMore: "Tap •••",
  // What screen readers say for the step above.
  installMoreSpoken: "Tap More",
  installShare: "Tap Share",
  installViewMore: "Tap View More",
  installAdd: "Tap Add to Home Screen",
  installConfirm: "Tap Add",
  installTitle: "Add to Home Screen",
  installHowTo: "Add to home",
  gotIt: "Got it",
  playAgain: "Play again",
  // Sample words in the steps' picture of the iPhone.
  installCopy: "Copy",
  installBookmark: "Add to Bookmarks",
  installReadingList: "Add to Reading List",
  installViewMoreButton: "View More",
  installNewTab: "New Tab",
  installFavorite: "Add to Favorites",
  installFind: "Find on Page",
  installShareButton: "Share",
  installAddButton: "Add",
  installWebApp: "Open as Web App",
}

export default widgets
