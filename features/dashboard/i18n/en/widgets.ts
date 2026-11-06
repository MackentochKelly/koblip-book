// Home's widgets: editing them on Home and the Widgets page, in English as
// ICU messages (docs/plans/translations.md, G4).
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
  // Each widget's title above it on Home: a short phrase, like an Apple
  // app's sections ("Get the most out of your iPhone"). The names above
  // stay the widgets' short labels.
  headings: {
    stats: "Your last 7 days",
    today: "Ask Koblip",
    bookings: "Your bookings",
    next: "Your next client",
    chart: "The next 14 days",
    newCustomers: "New faces this week",
    share: "Share your page",
    install: "The app on your Home Screen",
  },
  edit: "Edit widgets",
  done: "Done",
  add: "Add widget",
  remove: "Remove {name}",
  move: "Move {name}",
  show: "Show {name} on Home",
  noneShown: "No widgets on Home",
  savedFor: "Layout saved for",
  everyDevice: "All your devices",
  thisDevice: "This device only",
  failed: "Couldn't save. Try again.",
  // Read to screen readers while a widget is moved with the keyboard.
  instructions:
    "To move a widget, press Space. Use the arrow keys to move it, Space to drop it, or Escape to cancel.",
  picked: "Picked up {name}.",
  movedTo: "{name} moved to position {position, number} of {total, number}.",
  dropped: "{name} dropped at position {position, number} of {total, number}.",
  cancelled: "Moving {name} cancelled.",
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
} as const

export default widgets
