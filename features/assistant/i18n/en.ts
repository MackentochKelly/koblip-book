// The chat screen's words, in English as ICU messages
// (docs/plans/translations.md, G4). The server writes its own lines (step
// chips, card titles); these are the ones the screen itself shows.
const words = {
  title: "Assistant",
  back: "Back",
  newChat: "New chat",
  // The two views in the header.
  views: {
    label: "Assistant views",
    chat: "Chat",
    recent: "Recent",
  },
  recent: {
    empty: "No chats yet",
    failed: "Couldn't load your chats",
    openFailed: "Couldn't open that chat.",
  },
  working: "Thinking…",
  retry: "Try again",
  // The one line that folds the assistant's steps.
  work: {
    done: "Checked {count, plural, one {# thing} other {# things}}",
  },
  // The day and time picker under "When?"; a tap sends the picked time.
  times: {
    today: "Today",
    tomorrow: "Tomorrow",
    day: "Day",
    moreDates: "More dates",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    timesOf: "{part} times",
    pick: "Book {service} on {day} at {time}",
    // The same, with the team member picked.
    pickWith: "Book {service} with {member} on {day} at {time}",
  },
  // Quick-answer buttons: the first few, then one that shows the rest.
  choices: {
    more: "{n} more",
  },
  // What an answer was based on, e.g. "Based on 3 bookings".
  sources: {
    bookings: "Based on {n, plural, one {# booking} other {# bookings}}",
    services: "Based on {n, plural, one {# service} other {# services}}",
    team: "Based on {n, plural, one {# team member} other {# team members}}",
    customers: "Based on {n, plural, one {# client} other {# clients}}",
  },
  // Under each answer.
  actions: {
    copy: "Copy",
    retry: "Try again",
  },
  empty: {
    title: "How can I help today?",
    // One tap sends the words as they are.
    suggestions: {
      today: "What is on today?",
      free: "Who is free tomorrow?",
      book: "Book a client",
      services: "Show my services",
      week: "How is this week going?",
      customers: "Who are my newest customers?",
    },
    // Beside the floating globe, where room is short. A tap sends the
    // suggestion above with the same name.
    shortIdeas: {
      services: "My services",
      week: "This week",
      customers: "New customers",
    },
    // On an idea's close button, with the idea.
    closeIdea: "Close: {idea}",
  },
  composer: {
    placeholder: "Ask or tell {name}",
    label: "Message",
    send: "Send",
    stop: "Stop",
    micDenied: "Allow the microphone to speak.",
    // The first-tap intro to talking live.
    voiceIntro: {
      title: "Talk to {name}",
      speak:
        "Talk naturally. It answers out loud and writes it all in the chat.",
      tap: "Changes still need your yes: tap the button or say it.",
      privacy: "Your voice becomes text. We don't keep the recording.",
      continue: "Continue",
      neverShow: "Don't show again",
    },
    // Talking live, like ChatGPT voice.
    live: {
      start: "Talk live",
      connecting: "Connecting…",
      listening: "Listening…",
      thinking: "Thinking…",
      talking: "Talking…",
      end: "End",
      waveform: "Voice level",
    },
  },
  confirm: {
    // Closes the card; the other button says the action itself.
    cancel: "Not now",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
  },
  // The voice that talks live: picked the first time, changed in Settings.
  voice: {
    title: "Choose a voice",
    hint: "Tap a voice to hear it.",
    // On the play button, with the voice's name.
    play: "Play {name}",
    pause: "Pause {name}",
    // The language the voices speak in their samples.
    language: "Language",
    start: "Start talking",
    setting: "Voice",
    none: "None chosen",
    choose: "Choose",
    change: "Change",
    saved: "Voice saved",
    notSaved: "Couldn't save the voice. Try again.",
    unavailable: "Voices aren't available right now.",
    // ElevenLabs' voice labels; others show as they come.
    labels: {
      american: "American",
      british: "British",
      "latin american": "Latin American",
      peninsular: "Spain",
      male: "Male",
      female: "Female",
      neutral: "Neutral",
      young: "Young",
      middle_aged: "Middle-aged",
      old: "Older",
    },
  },
  errors: {
    rate_limited: "Too many messages. Wait a moment.",
    unavailable: "The assistant is not available. Try again.",
    too_long: "That message is too long.",
    not_allowed: "I can't do that here.",
    expired: "That request expired. Ask again.",
    bad_request: "That recording didn't work. Try again.",
  },
} as const

export default words
