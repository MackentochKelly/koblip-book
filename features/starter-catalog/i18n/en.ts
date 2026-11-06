// The "getting your page ready" screen's words, in English as ICU messages
// (docs/plans/translations.md, G4).
const words = {
  title: "Getting your page ready",
  helper: "Muse is adding what your customers can book",
  steps: {
    services: "Services",
    extras: "Extras",
    prices: "Prices",
    team: "Team",
    photos: "Team photos",
    policies: "Policies",
  },
  // "Haircut, Beard trim +3"
  more: "+{count, number}",
  // `price` comes formatted ("$25").
  from: "From {price}",
  photosDone: "{done, number} of {total, number}",
  policiesDone: "Booking policy, terms and privacy",
  working: "Working on it",
  done: "Done",
  waiting: "Next",
} as const

export default words
