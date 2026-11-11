// A team member's own area and their invite link
// (docs/plans/team-accounts.md), in English as ICU messages
// (docs/plans/translations.md, G4).
const words = {
  menu: "Menu",
  nav: {
    bookings: "Bookings",
    hours: "Hours",
    profile: "Profile",
  },
  bookings: {
    upcoming: "Upcoming",
    past: "Past",
    emptyUpcoming: "No upcoming bookings",
    emptyPast: "No past bookings yet",
    // Only these show a badge; a confirmed booking has none.
    status: {
      completed: "Done",
      no_show: "No-show",
      cancelled: "Cancelled",
    },
    // The customer redeemed a reward on it.
    reward: "Reward",
    // Paying outside the app: how, and where it stands. The owner marks
    // it; a team member only sees it.
    payment: {
      later: "Pays at the visit",
      status: {
        unpaid: "Payment pending",
        reported: "Being checked",
        paid: "Paid",
        refunded: "Refunded",
      },
      // What the card paid when booking, in place of "Payment pending".
      paidOnline: "Paid online: {amount}",
      // The customer's picture of the payment, while the owner lets the
      // team see them (docs/plans/payment-proof.md).
      proof: "Payment proof",
      proofDeleted: "Deleted on {date, date, medium}",
    },
  },
  hours: {
    closed: "Closed",
    // One short helper line under the title.
    note: "The owner sets your hours.",
  },
  profile: {
    jobTitle: "Job title",
    about: "About",
    languages: "Languages",
    optional: "Optional",
    save: "Save",
    saved: "Saved",
    failed: "Couldn't save. Try again.",
    seePublic: "See my public profile",
    logOut: "Log out",
    photo: "{name}'s photo",
    // Their numbers from before Koblip (TEAM_RULES.startingCounts).
    before: {
      title: "Before Koblip",
      note: "Added to the numbers on your profile.",
      appointments: "Appointments",
      clients: "Clients",
      reset: "Reset to 0",
      error: "Clients can't be more than appointments.",
    },
  },
  photos: {
    change: "Change",
    addPhoto: "Add photo",
    remove: "Remove",
    errors: {
      not_found: "That did not work. Please try again.",
      missing: "Pick a photo.",
      too_big: "That photo is too big.",
      wrong_type: "Use a JPEG, PNG or WebP photo.",
      limit: "That's too many photos.",
    },
  },
  join: {
    title: "Join {business}",
    intro: "Your bookings, hours and profile as {name}.",
    join: "Join",
    logIn: "Log in to join",
    signedInAs: "Signed in as {email}",
    expired: {
      title: "This link doesn't work anymore",
      text: "Ask for a new link.",
    },
    taken: "Someone already joined as this person. Ask for a new link.",
    alreadyMember: "This account already has a place in this business.",
    failed: "Couldn't join. Try again.",
  },
} as const

export default words
