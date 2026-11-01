// Home's widgets: editing them on Home and the Widgets page.
const widgets = {
  title: "Widgets",
  names: {
    stats: "Numbers",
    today: "Today",
    bookings: "Bookings",
    next: "Next booking",
    chart: "Coming up",
    newCustomers: "New customers",
    share: "Share your page",
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
}

export default widgets
