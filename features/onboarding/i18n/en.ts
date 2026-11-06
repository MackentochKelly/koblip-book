// The "find your business" box and the Google Maps details screen, in
// English as ICU messages (docs/plans/translations.md, G4).
const words = {
  modes: {
    label: "How to find your business",
    search: "Search",
    link: "Maps link",
  },
  errors: {
    invalid: "Paste a Google Maps link",
    not_found: "That business was not found on Google Maps",
    failed: "That did not work. Please try again.",
  },
  hint: "Free to try, no card needed",
  building: "Building your page…",
  searchAgain: "Search again",
  notYours: "Not your business?",
  nearMe: "Near me",
  anywhere: "Anywhere",
  closeSearch: "Close search",
  businessName: "Your business name",
  // Typed one after another in the empty search box, in this order, then
  // businessName. Each fits ONBOARDING_RULES.maxHintLength.
  businessNameExamples: {
    search: "Search your business",
    sample: "Lumen Studio",
    kinds: "Your salon, clinic or shop",
  },
  clear: "Clear",
  noneFound: "No business found",
  mapsLink: "Google Maps link",
  continue: "Continue",
  area: {
    title: "Search near",
    helper: "Find businesses close to you",
    useLocation: "Use my current location",
    notFound: "Couldn't find you. Try again or pick a city.",
    waiting: "Taking longer than expected. You can pick a city.",
    timeout: "Location timed out. Try again or pick a city.",
    turnOnLocation:
      "Turn on location for this browser in your device settings and reload, or pick a city.",
    locationOff:
      "Location is off. Turn it on in your browser and device settings and reload, or pick a city.",
    or: "or pick a city",
    city: "Search a city",
  },
  // Right after sign-up: the page's details from Google Maps, row by row.
  found: {
    title: "Your Google Maps details",
    helper: "What we took from your listing",
    steps: {
      name: "Name",
      category: "Category",
      address: "Address",
      phone: "Phone",
      hours: "Opening hours",
      photos: "Photos",
      rating: "Rating",
      about: "About",
    },
    openDays: "{days, plural, =7 {Open every day} other {Open # days a week}}",
    photoCount: "{count, plural, other {# photos}}",
    // `rating` comes formatted ("4.8").
    rating: "{rating} · {reviews, plural, other {# reviews}}",
    aboutByMuse: "Written by Muse",
    working: "Loading",
    done: "Done",
    waiting: "Next",
  },
} as const

export default words
