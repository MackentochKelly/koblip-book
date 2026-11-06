// The public page's and booking's own words, and the home page's, in
// English as ICU messages (docs/plans/translations.md, G4). The business's
// texts (About, services) are translated elsewhere.
const words = {
  sections: {
    services: "Services",
    team: "Team",
    reviews: "Reviews",
    portfolio: "Portfolio",
    hours: "Opening times",
    about: "About",
    info: "Additional information",
    location: "Location",
    pageSections: "Page sections",
    // The service categories' tabs, and the group of services with no
    // category (docs/plans/service-categories.md).
    serviceCategories: "Service categories",
    otherServices: "Other",
  },
  page: {
    viewMore: "View more",
    openInMaps: "Open in Google Maps",
    contact: "Contact",
    share: "Share",
    linkCopied: "Link copied",
    verified: "Verified",
    seeAll: "See all",
    backToDashboard: "Back to dashboard",
    // A business page that doesn't exist (app/(public)/b/[slug]).
    notFound: {
      title: "This page does not exist",
      text: "Check the link you received, or ask the business for a new one.",
    },
  },
  status: {
    temporarilyClosed: "Temporarily closed",
    closed: "Closed",
    openNow: "Open now",
    closedNow: "Closed now",
  },
  hours: {
    closed: "Closed",
    open24: "Open 24 hours",
    today: "Today",
  },
  amenities: {
    wheelchair: "Wheelchair accessible",
    parking: "Parking available",
    pets: "Pet-friendly",
    kids: "Kid-friendly",
    restroom: "Restroom",
    cards: "Accepts cards",
    nfc: "Mobile payments",
    cash_only: "Cash only",
  },
  actions: {
    bookNow: "Book now",
    book: "Book",
    directions: "Directions",
    call: "Call",
    website: "Website",
  },
  reviews: {
    none: "No Google reviews yet.",
    seeMore: "See more reviews",
    seeAllOnGoogle: "See all reviews on Google",
    order: "Most relevant reviews from",
    count: "{n, plural, one {review} other {reviews}}",
  },
  photos: {
    photos: "Photos",
    photoOf: "Photo {index, number} of {total, number}",
    seeMore: "See {more, number} more photos",
    photoBy: "Photo by",
    close: "Close",
  },
  footer: {
    rights: "All rights reserved.",
    fromGoogle: "Photos, opening times and reviews from",
    builtBy: "Built by",
  },
  // A team member's public profile (docs/plans/team-accounts.md).
  teamProfile: {
    appointments: "Appointments",
    clients: "Clients",
    // Their first name: the business's own About follows.
    about: "About {name}",
    hours: "{name}'s hours",
    languages: "Languages",
  },
  // The business's own policies, linked from its page's footer.
  policies: {
    booking: "Booking policy",
    terms: "Terms of service",
    privacy: "Privacy notice",
    // Said before each name in a sentence ("I agree to the Booking policy").
    articles: { booking: "the", terms: "the", privacy: "the" },
    backTo: "Back to {name}",
    updated: "Last updated",
  },
  booking: {
    titles: {
      service: "Select a service",
      extras: "Add extras",
      member: "Select a professional",
      time: "Pick a time",
      details: "Your details",
      policies: "Before you book",
    },
    stepOf: "Step {index, number} of {total, number}",
    anyone: "Anyone",
    whoeverFree: "Whoever is free",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    timesOf: "{part} times",
    timesFailed: "Times could not load",
    tryAgain: "Try again",
    noTimes: "No free times",
    today: "Today",
    tomorrow: "Tomorrow",
    day: "Day",
    moreDates: "More dates",
    name: "Name",
    phone: "Phone",
    addName: "Add your name",
    checkPhone: "Check your phone number",
    // Meta's opt-in: the business's name and that messages come (the ⓘ on
    // Phone); booking is the customer's yes.
    whatsappNotice:
      "By booking, you'll get WhatsApp messages from {business} about this booking.",
    whatsappAbout: "About WhatsApp messages",
    total: "Total",
    with: "with {name}",
    free: "Free",
    continue: "Continue",
    back: "Back",
    close: "Close",
    confirm: "Confirm booking",
    // The last step's box; the policy names that follow are links.
    agreeTo: "By booking, you agree to",
    agreeToThese: "By booking, you agree to these policies.",
    sending: "Booking…",
    bookedTitle: "You're booked",
    expecting: "{name} is expecting you.",
    done: "Done",
    taken: "That time was just taken. Pick another one.",
    failed: "The booking did not go through. Please try again.",
    extrasRequired: "{min, plural, one {Pick one} other {Pick #}}",
    extrasUpTo: "Up to {max, number}",
    optional: "Optional",
    manage: "Manage your booking",
  },
  // The customer's own area: sign in with the phone they booked with and a
  // code on WhatsApp, then their bookings at every business.
  account: {
    addPhone: "Add your phone",
    phoneHelp: "The one you booked with. We'll WhatsApp you a code.",
    sendCode: "Send code",
    sendingCode: "Sending…",
    code: "Code",
    codeSentTo: "Enter the code sent to {phone}.",
    verify: "Continue",
    checking: "Checking…",
    wrongCode: "That code didn't work. Try again.",
    expiredCode: "That code expired. Ask for a new one.",
    tooManyTries: "Too many tries. Ask for a new code.",
    tooFast: "Too many codes. Wait a minute.",
    phoneTaken: "That phone is on another account.",
    sendFailed: "The code didn't send. Try again.",
    newCode: "Send a new code",
    changePhone: "Change number",
    title: "My bookings",
    hello: "Hi, {name}",
    upcoming: "Upcoming",
    past: "Past",
    none: "No bookings yet",
    noneUpcoming: "Nothing coming up",
    cancelled: "Cancelled",
    bookAgain: "Book again",
    signOut: "Log out",
    cancel: "Cancel",
    cancelTitle: "Cancel this booking?",
    cantComeTitle: "Can't make it?",
    willBeTold: "{business} will be told.",
    keep: "Keep it",
    cancelBooking: "Cancel booking",
    tellThem: "Tell them",
    cancelDone: "Booking cancelled",
    told: "They know",
    actionFailed: "That didn't work. Try again.",
    reschedule: "Reschedule",
    newTime: "Pick a new time",
    now: "Now: {when}",
    moveTo: "Move booking",
    moving: "Moving…",
    moved: "Booking moved",
    timeTaken: "That time was just taken. Pick another one.",
  },
  // The home page (Koblip Book's own page for owners).
  home: {
    description: "Your booking page in one minute.",
    logIn: "Log in",
    dashboard: "Dashboard",
    titleStart: "Get your booking page in one",
    titleEnd: "minute",
    findOn: "Search your business on",
    maps: "Google Maps.",
    weTurn: "Koblip fills in the rest, automatically.",
    worksWith: "Works with",
    remindersOnWhatsApp: "Reminders on WhatsApp",
    // The "Made for" row: kinds of business clients book with.
    madeFor: {
      title: "Made for",
      clinics: "Clinics",
      dentists: "Dentists",
      beauty: "Beauty",
      spas: "Spas",
      fitness: "Fitness",
      therapists: "Therapists",
      tutors: "Tutors",
      petCare: "Pet care",
      carCare: "Car care",
      repairs: "Repairs",
      more: "And more",
    },
    soon: "Soon",
    footer: {
      legal: "Legal",
      privacy: "Privacy",
      terms: "Terms",
      pages: "Pages",
      backToTop: "Back to top",
    },
    faq: {
      title: "Questions",
      titleStart: "Your questions,",
      titleEnd: "answered",
      subtitle: "Everything you need to know.",
      // In the order shown (components/home-faq.tsx).
      items: {
        free: {
          q: "Is it free?",
          a: "Yes, it's free for now. No card needed.",
        },
        start: {
          q: "What do I need to start?",
          a: "Just your business on Google Maps. Koblip builds your page from it.",
        },
        who: {
          q: "Which businesses can use it?",
          a: "Any business clients book with: clinics, studios, beauty, fitness and more.",
        },
        app: {
          q: "Do my clients need an app?",
          a: "No. Your link opens in any browser, on any phone or computer.",
        },
        change: {
          q: "Can I change my page later?",
          a: "Yes. Edit it in your dashboard, or just ask your AI assistant.",
        },
        spanish: {
          q: "Does it work in Spanish?",
          a: "Yes. Your page shows in your client's language, English or Spanish.",
        },
      },
    },
    pricing: {
      title: "Pricing",
      titleStart: "Start for",
      titleEnd: "free",
      subtitle: "No card needed. Pro is coming soon.",
      perMonth: "/month",
      proSample: "Ana paid for her visit",
      // Each plan's list, in the order shown (components/home-pricing.tsx).
      free: {
        name: "Free",
        note: "Free for now. No card needed.",
        features: {
          page: "Your page from Google Maps",
          bookings: "Online bookings, day or night",
          catalog: "Services, team and hours",
          assistant: "AI assistant, by typing or voice",
          reminders: "Reminders on WhatsApp",
          calendar: "Google Calendar",
          languages: "English and Spanish",
        },
      },
      pro: {
        name: "Pro",
        note: "More ways to get booked and paid.",
        features: {
          everything: "Everything in Free",
          payments: "Payments with Stripe",
          sms: "Text reminders by SMS",
          buttons: "Book buttons on Instagram and Facebook",
          reviews: "Google review requests",
        },
      },
    },
    everything: {
      title: "Everything",
      titleStart: "Everything your business",
      titleEnd: "needs",
      subtitle: "One place for your whole day.",
      items: {
        bookings: {
          title: "Bookings and services",
          text: "Your calendar, services and extras, always up to date.",
        },
        customers: {
          title: "Customers",
          text: "Everyone who booked, with their visits.",
        },
        team: {
          title: "Team",
          text: "Each member has a login, hours and a profile.",
        },
        automations: {
          title: "Automations",
          text: "Reminders and replies on WhatsApp, on their own.",
        },
        reports: {
          title: "Reports",
          text: "See what's booked most, week by week.",
        },
        apps: {
          title: "Your apps, connected",
          text: "Works with the tools you already use.",
        },
      },
      // Each app's name and what Koblip does with it are the shared `app`
      // words (lib/i18n/en/app.ts).
      allApps: {
        button: "See all apps",
        title: "All apps",
        ready: "Works today",
        soon: "Coming soon",
      },
      // The sample shown in the pictures.
      sample: {
        visits: "visits",
        // The team's hours, one per person (components/day-previews.tsx).
        hours: {
          weekdays: "Mon to Fri",
          tuesdayToSaturday: "Tue to Sat",
          weekends: "Weekends",
        },
        reminder: "Hi Ana, see you tomorrow.",
        confirm: "Confirm",
        week: "Week",
        month: "Month",
        bookings: "bookings",
      },
    },
    cta: {
      title: "Get your booking page today",
      button: "Find your business",
    },
    // The small card in the corner (components/support-box.tsx).
    support: {
      title: "Enjoying Koblip Book?",
      text: "A star on GitHub helps a lot. Thank you, your support matters.",
      star: "Star on GitHub",
      demo: "Try the demo",
      close: "Close",
    },
    // "See it in action": the real app on the visitor's own demo copy.
    action: {
      title: "See it in action",
      titleStart: "See it",
      titleEnd: "in action",
      subtitle: "This is the real app. Book, and watch it arrive.",
      steps: {
        page: "Book",
        dashboard: "See it arrive",
        assistant: "Ask your AI",
        try: "Try it yourself",
      },
      hints: {
        page: "Pick a time on the real booking page.",
        dashboard: "Your booking lands here in seconds.",
        assistant: "Ask what's on today, or move a booking.",
        try: "Open the full app. Click anything.",
      },
      // Step 4: the visitor's same demo, as the full app in a new tab.
      open: {
        dashboard: "Open the dashboard",
        page: "Booking page",
      },
      tabsLabel: "Demo screens",
      tabs: { page: "Page", dashboard: "Dashboard", assistant: "Assistant" },
      frames: {
        page: "Demo booking page",
        dashboard: "Demo dashboard",
        assistant: "Demo AI assistant",
      },
      tooMany: "Too many demos opened from here. Try again in an hour.",
      failed: "The demo didn't open.",
      retry: "Try again",
      hideTips: "Hide tips",
    },
    steps: {
      title: "How it works",
      find: "Find your business",
      findText: "Search it on Google Maps.",
      signIn: "Sign in with Google",
      signInText: "One tap. Free.",
      check: "AI builds your page",
      checkText: "Services, prices, photos, team.",
      share: "Get booked",
      shareText: "Share your link. Bookings come in.",
      // The sample shown in the step pictures (its names, address and link
      // are the same in every language: components/feature-preview.tsx).
      sample: {
        search: "Search",
        google: "Continue with Google",
        signedIn: "Signed in · Free",
        // The sample's two services, in order.
        services: { haircut: "Haircut", colour: "Colour" },
        copy: "Copy",
        copied: "Copied",
        replay: "Play again",
        ready: "Ready",
        team: "Team",
        openToday: "Open today",
        share: "Share",
        newBooking: "New booking",
        bookingService: "Haircut",
        bookingTime: "15:00",
      },
    },
    features: {
      title: "What you get",
      subtitle: "Everything to take bookings, ready from day one.",
      previous: "Previous",
      next: "Next",
      page: "Your page in 1 minute",
      pageText: "Built from your Google Maps listing.",
      book: "Clients book online, day or night",
      bookText: "Your services, team and free times on one page.",
      assistant: "Just ask your AI assistant",
      assistantText: "Bookings, services and hours, by typing or voice.",
      language: "In your clients' language",
      languageText: "Your page shows in English or Spanish.",
      // The sample app shown in the card pictures.
      sample: {
        book: "Book",
        day: "Tuesday 14",
        // The day's free times, in order.
        times: { first: "10:00 am", second: "11:30 am", third: "3:00 pm" },
        ask: "Book Ana at 3 pm",
        done: "Done. Ana is booked for 3 pm.",
        booked: "Booked",
        confirmed: "Confirmed",
      },
    },
    provider: {
      ownNumber: "Your own WhatsApp number",
      ownNumberText: "Connect yours in a few taps.",
      reminders: "Reminders on WhatsApp",
      remindersText: "Clients get their booking reminders there.",
      checked: "Checked by Meta",
      checkedText: "Meta verified us to connect your business.",
    },
  },
  hackathon: {
    badge: "Built for the Meta AI Hackathon",
    about: "Built {dates}, with {models, number} Meta models.",
    tabs: { ai: "Meta AI", rules: "Rules", whatsapp: "WhatsApp" },
    ai: {
      assistant: {
        title: "Assistant for your day",
        description: "Ask in plain words. You approve.",
      },
      voice: {
        title: "Talk instead of typing",
        description: "It hears you live.",
      },
      setup: {
        title: "Page ready in a minute",
        description: "Services and prices from Google Maps.",
      },
      portraits: {
        title: "Photos for your team",
        description: "Drawn until you add real ones.",
      },
      about: {
        title: "About text written for you",
        description: "Shown on your booking page.",
      },
      translate: {
        title: "Your page in Spanish",
        description: "Services and details translated.",
      },
    },
    rules: {
      newWork: "Made during the event, from {date}",
      openSource: "Open source on GitHub",
      metaModels: "Runs on Meta's models",
      control: "Nothing changes without your yes",
      track: "Track: Build for Your World",
    },
    code: "See the code",
    event: "Event page",
    // The ⓘ beside each title: the same thing, explained in full.
    more: "More about this",
    sections: {
      what: "What it does",
      how: "How it works",
      note: "Good to know",
    },
    details: {
      assistant: {
        what: "Runs your day with you: bookings, customers, services, add-ons, team, hours and free times.",
        how: "Type or talk in plain words, like “Book Ana at 3 pm”. It answers from your real data.",
        note: "Before any change, it shows a card with what it will do. Nothing happens until you tap yes.",
      },
      setup: {
        what: "Builds your first booking page from your Google Maps listing.",
        how: "Pick your business. It suggests services with prices and times, add-ons, a starter team and your policies.",
        note: "These are only a start. Edit or remove anything later.",
      },
      about: {
        what: "Writes the short intro customers read on your booking page.",
        how: "It uses your business's own facts, never Google reviews. In your details, it can also tidy what you wrote.",
        note: "Nothing is saved until you save it.",
      },
      translate: {
        what: "Shows your page in Spanish too, so more customers can book.",
        how: "Your services and business details are translated for you. Only new or changed texts are sent again.",
        note: "Customers pick English or Spanish on your page.",
      },
      voice: {
        what: "Lets you use the assistant by talking, hands-free.",
        how: "Turn on talking mode and speak. Muse Voice Transcribe hears you live, and the assistant answers out loud.",
        note: "Spoken replies use ElevenLabs voices.",
      },
      portraits: {
        what: "Gives each starter team member a photo, so your page never looks empty.",
        how: "It draws one from the person's role and what they're good at.",
        note: "Upload a real photo anytime to replace it.",
      },
      newWork: {
        what: "The hackathon only counts work built during the event.",
        how: "Our first commit is from {date}. Every change since is dated in the public history.",
      },
      openSource: {
        what: "The hackathon asks for a public repository.",
        how: "All of Koblip Book's code is on GitHub for anyone to read.",
      },
      metaModels: {
        what: "Every project must use Meta's models.",
        how: "Muse Spark writes and thinks, Muse Voice Transcribe listens and Muse Image draws, all through the Meta Model API.",
        note: "Spoken replies use ElevenLabs.",
      },
      control: {
        what: "The AI helps you. It never acts behind your back.",
        how: "The assistant shows each change on a card and waits for your yes. Every change it makes is logged.",
      },
      track: {
        what: "Our hackathon track: bring Meta's models into a world you know.",
        how: "Local businesses lose hours to bookings and messages. Koblip Book gives that time back.",
      },
      ownNumber: {
        what: "Send WhatsApp messages from your own business number.",
        how: "Connect it in a few taps, so messages come from your business.",
      },
      reminders: {
        what: "Customers get their booking messages on WhatsApp.",
        how: "A confirmation when they book, reminders before the visit, and a note if it changes or is cancelled.",
        note: "You choose when reminders go out.",
      },
      checked: {
        what: "Koblip is a verified Meta Tech Provider.",
        how: "Meta reviewed our business before approving us to connect businesses to WhatsApp.",
      },
    },
  },
  // The Privacy and Terms pages, in short plain sections.
  legal: {
    updated: "Last updated: {date}",
    privacy: {
      title: "Privacy Policy",
      sections: {
        collect: {
          title: "What we collect",
          points: {
            account:
              "Your account: name, email and password (stored scrambled), or your Google profile if you sign in with Google.",
            business:
              "Your business: details from Google Maps, plus the services, team, hours and photos you add.",
            clients:
              "Your clients: the name, phone, note and bookings they enter on your page.",
            chats: "Assistant chats you type. Live voice audio is not kept.",
          },
        },
        device: {
          title: "On your device",
          points: {
            cookies:
              "Only the cookies we need: your sign-in and your language. No ad or tracking cookies.",
            theme: "Light or dark mode is saved on your device.",
            location:
              "Your location is used only if you allow it, to search near you, and is not stored.",
          },
        },
        helpers: {
          title: "Who helps us",
          points: {
            providers:
              "Google (Maps, Places and sign-in), Meta (AI assistant), ElevenLabs (voice) and our email provider. They get only what each task needs.",
            noSale: "We never sell your data and never show ads.",
          },
        },
        keep: {
          title: "How long we keep it",
          points: {
            open: "While your account is open.",
            unclaimed:
              "A business page that nobody claims is deleted after 24 hours.",
          },
        },
        choices: {
          title: "Your choices",
          points: {
            yourData:
              "You can ask to see, fix or delete your data at any time: write to {contact}.",
            clients:
              "Clients can ask the business, or us, to remove their details.",
          },
        },
      },
    },
    terms: {
      title: "Terms of Service",
      sections: {
        account: {
          title: "Your account",
          points: {
            safe: "Keep your sign-in safe. You are responsible for what happens in your account.",
            claim: "Only claim a business you own or are allowed to manage.",
          },
        },
        content: {
          title: "Your content",
          points: {
            responsible:
              "You are responsible for the details, photos and prices on your page.",
            allowed:
              "Do not post anything illegal, misleading or that you do not have the right to use.",
          },
        },
        bookings: {
          title: "Bookings",
          points: {
            agreement:
              "A booking is an agreement between the business and its client. Koblip is not part of it.",
            refunds:
              "Businesses handle their own cancellations, payments and refunds.",
          },
        },
        assistant: {
          title: "The assistant",
          points: {
            confirm:
              "AI answers can be wrong. Nothing changes until you confirm it with a tap.",
            google: "Details from Google Maps follow Google's own terms.",
          },
        },
        price: {
          title: "Price",
          points: {
            free: "Koblip Book is free for now. We will tell you well before any charge starts.",
          },
        },
        ending: {
          title: "Ending and changes",
          points: {
            close:
              "You can close your account at any time. We may close accounts that break these terms.",
            asIs: "The service is provided as is, without promises that it will never fail.",
            changes:
              "If these terms change, we will update the date above and let owners know.",
            questions: "Questions: {contact}.",
          },
        },
      },
    },
  },
} as const

export default words
