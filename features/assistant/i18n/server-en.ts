// Lines the server writes for the owner: step chips, confirm card
// titles, tap results, and the error sentences tools return. Database
// names (services, team, customers) are inserted, never translated.
// The audit log summaries stay in English (they are for developers).
const messages = {
  locale: "en-US",
  // One line in the short dynamic prompt part, so the model answers in
  // the owner's language from the first word.
  languageLine: "Reply in English.",
  steps: {
    overview: "Checking business…",
    services: "Listing services…",
    addons: "Listing extras…",
    team: "Listing team…",
    bookings: "Finding bookings…",
    customer: "Finding customer…",
    stats: "Counting bookings…",
    customers: "Listing customers…",
    createService: "Creating service…",
    updateService: "Updating service…",
    deleteService: "Deleting service…",
    renameMember: "Renaming team member…",
    setBookingStatus: "Updating booking…",
    cancelBooking: "Cancelling booking…",
    deleteMember: "Removing team member…",
    hours: "Replacing hours…",
    freeTimes: "Checking free times…",
    booking: "Booking…",
    createMember: "Adding team member…",
    serviceTeam: "Saving service team…",
    memberServices: "Saving member services…",
    createAddon: "Creating extras…",
    updateAddon: "Updating extras…",
    deleteAddon: "Deleting extras…",
    updateBusiness: "Saving business details…",
    working: "Working…",
    checking: "Checking the answer…",
  },
  loop: {
    invalidArgs: "those arguments were not valid, ask for what is missing",
    lookupFailed: "that lookup failed, try asking differently",
    tooMany: "too many pending confirmations, answer one first",
    stopped: (maxSteps: number) =>
      `I ran out of steps after ${maxSteps} lookups — ask me to narrow it down.`,
  },
  confirm: {
    unchanged: "Okay, nothing was changed.",
    unavailable: "That action is no longer available.",
  },
  // Risky tools never run from a model call; the model only relays these.
  tapFirst: {
    cancel: "cancelling needs the owner's tap first",
    deleteService: "deleting needs the owner's tap first",
    deleteMember: "removing needs the owner's tap first",
    hours: "changing hours needs the owner's tap first",
    booking: "booking needs the owner's tap first",
    updateService: "changing needs the owner's tap first",
    serviceTeam: "changing a service team needs the owner's tap first",
    memberServices: "changing a member's services needs the owner's tap first",
    createAddon: "creating extras needs the owner's tap first",
    updateAddon: "changing extras needs the owner's tap first",
    deleteAddon: "deleting extras needs the owner's tap first",
    updateBusiness: "changing the business details needs the owner's tap first",
  },
  cards: {
    cancel: "Cancel this booking?",
    deleteService: "Delete this service?",
    deleteMember: "Remove this team member?",
    hours: "Replace opening hours?",
    book: "Book this appointment?",
    updateService: "Change this service?",
    serviceTeam: "Change who does this service?",
    memberServices: "Change this member's services?",
    createAddon: "Create these extras?",
    updateAddon: "Change these extras?",
    deleteAddon: "Delete these extras?",
    updateBusiness: "Change the business details?",
  },
  actions: {
    cancelBooking: "Cancel booking",
    deleteService: "Delete",
    deleteMember: "Remove",
    hours: "Replace hours",
    book: "Book",
    updateService: "Change",
    serviceTeam: "Save",
    memberServices: "Save",
    createAddon: "Create",
    updateAddon: "Change",
    deleteAddon: "Delete",
    updateBusiness: "Save",
  },
  booking: {
    minutes: (durationMinutes: number) => `${durationMinutes} min`,
    anyone: "Anyone",
    noPrice: "No price",
    free: "Free",
    closedWeek: "Closed all week",
    at: (day: string, time: string) => `${day} at ${time}`,
    booked: (name: string, service: string, when: string) =>
      `Booked ${name} for ${service} on ${when}.`,
    couldNotBook: (reason: string) => `Could not book: ${reason}.`,
    conflictClosed: "the business is closed then",
    conflictTaken: "that time was just taken",
    fields: {
      service: "unknown service",
      teamMember: "unknown team member",
      date: "bad date",
      time: "bad time",
      name: "bad customer name",
      phone: "bad phone number",
      note: "note too long",
      addons: "bad add-ons",
    },
    invalidFallback: "invalid input",
    failed: "Could not book: something went wrong.",
  },
  cancel: {
    unknown: "Could not cancel: unknown booking.",
    failed: (error: string) => `Could not cancel the booking (${error}).`,
    done: "Cancelled the booking.",
  },
  deleteService: {
    unknown: "Could not delete: unknown service.",
    failed: (error: string) => `Could not delete the service (${error}).`,
    done: "Deleted the service.",
  },
  updateService: {
    unknown: "Could not change: unknown service.",
    failed: (error: string) => `Could not change the service (${error}).`,
    done: "Changed the service.",
  },
  deleteMember: {
    unknown: "Could not remove: unknown team member.",
    failed: (error: string) => `Could not remove the team member (${error}).`,
    done: "Removed the team member.",
  },
  serviceTeam: {
    anyone: "anyone",
    unknown: "Could not save: unknown service.",
    failed: (error: string) => `Could not save the service team (${error}).`,
    done: "Service team updated.",
  },
  memberServices: {
    none: "no services",
    unknown: "Could not save: unknown team member.",
    failed: (error: string) => `Could not save the member services (${error}).`,
    done: "Member services updated.",
  },
  createAddon: {
    failed: (error: string) => `Could not create the extras (${error}).`,
    done: "Extras created.",
  },
  updateAddon: {
    unknown: "Could not change: unknown extras group.",
    failed: (error: string) => `Could not change the extras (${error}).`,
    done: "Extras changed.",
  },
  deleteAddon: {
    unknown: "Could not delete: unknown extras group.",
    failed: (error: string) => `Could not delete the extras (${error}).`,
    done: "Extras deleted.",
  },
  updateBusiness: {
    failed: (error: string) => `Could not save the business details (${error}).`,
    done: "Business details updated.",
    fields: {
      name: "Name",
      address: "Address",
      about: "About",
      phone: "Phone",
      website: "Website",
      seats: "Seats",
    },
  },
  hours: {
    invalid: "Could not save: invalid hours.",
    failed: (error: string) => `Could not save the hours (${error}).`,
    done: "Opening hours updated.",
  },
  // Sentences the tools return to the model when arguments are wrong.
  // Field names (serviceId, YYYY-MM-DD) stay as-is: they are codes.
  errors: {
    serviceIdRequired:
      "serviceId is required: list services first and use an id from the list",
    serviceUnknown:
      "unknown service id: list services first and use an id from the list",
    memberIdRequired:
      "memberId is required: list the team first and use an id from the list",
    memberUnknown:
      "unknown team member id: list the team first and use an id from the list",
    teamMemberInvalid: "teamMemberId must be an id from list_team or omitted",
    serviceRequired: "service is required: the service name the owner said",
    serviceWhich: (names: string) =>
      `which service? ask the owner to pick one of: ${names}`,
    memberWhich: (names: string) =>
      `which team member? ask the owner to pick one of: ${names}`,
    bookingDayInvalid: "day must be today or tomorrow; use date for other days",
    slotNotFree: (times: string) =>
      `that time is not free; free times that day: ${times}`,
    dayNotFree: "nothing is free that day: ask for another day",
    dateInvalid: "date must be a real YYYY-MM-DD date",
    timeInvalid: "time must be HH:mm",
    nameRequired: "customer name is required",
    phoneInvalid: "bad phone number",
    noteInvalid: "bad note",
    noteTooLong: "note too long",
    datePast: "date is in the past: book today or later",
    rangeInvalid: "range must be upcoming or past",
    dayInvalid: (key: string) => `${key} must be YYYY-MM-DD`,
    dayChoiceInvalid: "day must be yesterday, today or tomorrow",
    dayAlone: "day already covers the whole day: leave out from, to and range",
    statusUnknown: "unknown status",
    queryInvalid: (max: number) => `query must be 1-${max} characters`,
    nameInvalid: (max: number) => `name must be 1-${max} characters`,
    nothingToChange: "Nothing to change.",
    minutesInvalid: (options: string) => `minutes must be one of ${options}`,
    priceInvalid: "priceMinor must be null or an integer within range",
    descriptionInvalid: (max: number) =>
      `description must be at most ${max} characters`,
    bookingIdRequired:
      "bookingId is required: list bookings first and use an id from the list",
    bookingUnknown:
      "unknown booking id: list bookings first and use an id from the list",
    statusInvalid:
      "status must be confirmed, completed or no_show (cancelling needs a tap)",
    rowsInvalid: (max: number) =>
      `rows must be at most ${max} of weekday 0-6 with open and close HH:mm`,
    freeTimesUnknown:
      "unknown service or team member: list them first and use an id from the list",
    fromInvalid: "from must be a real YYYY-MM-DD date, today or later",
    toInvalid: "to must be a real YYYY-MM-DD date on or after from",
    spanInvalid: (max: number) => `ask for at most ${max} days at once`,
    rangeTooLong: (max: number) => `ask for at most ${max} days at once`,
    sortInvalid: "sort must be bookings, spent, lastVisit or firstBooking",
    groupIdRequired:
      "groupId is required: list add-ons first and use an id from the list",
    groupUnknown:
      "unknown extras group id: list add-ons first and use an id from the list",
    promptInvalid: (max: number) => `prompt must be 1-${max} characters`,
    selectsInvalid: "minSelect and maxSelect must fit the number of options",
    optionsInvalid: (max: number) =>
      `options must be 1-${max} with a name, duration and price`,
    businessNameInvalid: (max: number) => `name must be 1-${max} characters`,
    addressInvalid: (max: number) => `address must be at most ${max} characters`,
    aboutInvalid: (max: number) => `about must be at most ${max} characters`,
    websiteInvalid: "website must be an http(s) URL",
    seatsInvalid: (max: number) => `seats must be between 1 and ${max}`,
  },
}

export default messages
