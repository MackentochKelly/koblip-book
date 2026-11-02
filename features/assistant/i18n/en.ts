// The chat screen's words. The server writes its own lines (step chips,
// card titles); these are the ones the screen itself shows.
const messages = {
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
    done: (count: number) =>
      count === 1 ? "Checked 1 thing" : `Checked ${count} things`,
  },
  locale: "en-US",
  // The day and time picker under "When?"; a tap sends the picked time.
  times: {
    today: "Today",
    tomorrow: "Tomorrow",
    day: "Day",
    moreDates: "More dates",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    timesOf: (part: string) => `${part} times`,
    pick: (service: string, member: string | null, day: string, time: string) =>
      `Book ${service}${member ? ` with ${member}` : ""} on ${day} at ${time}`,
  },
  // Quick-answer buttons: the first few, then one that shows the rest.
  choices: {
    more: (n: number) => `${n} more`,
  },
  // What an answer was based on, e.g. "Based on 3 bookings".
  sources: {
    bookings: (n: number) =>
      n === 1 ? "Based on 1 booking" : `Based on ${n} bookings`,
    services: (n: number) =>
      n === 1 ? "Based on 1 service" : `Based on ${n} services`,
    team: (n: number) =>
      n === 1 ? "Based on 1 team member" : `Based on ${n} team members`,
    customers: (n: number) =>
      n === 1 ? "Based on 1 client" : `Based on ${n} clients`,
  },
  // When the answer could not be double-checked.
  unverified: "Not double-checked. Please verify.",
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
    closeIdea: "Close",
  },
  composer: {
    placeholder: "Ask or tell me what to do",
    label: "Message",
    send: "Send",
    stop: "Stop",
    micDenied: "Allow the microphone to speak.",
    // The first-tap intro to talking live.
    voiceIntro: {
      title: "Talk to your assistant",
      speak:
        "Talk naturally. It answers out loud and writes it all in the chat.",
      tap: "Changes still need a tap on the screen.",
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
      // Said out loud when an answer waits for a tap on its card.
      confirmLine: "To do it, tap the button on the screen.",
      // Said out loud when an answer's check could not back it.
      uncheckedLine: "Heads up, I couldn't double-check that. Have a look on the screen.",
      // Said once when talking starts.
      greeting: "Hey! What's up?",
      // Said once if an answer is slow.
      fillers: ["Hmm, lemme see.", "Hang on, almost got it.", "Okay, one sec."],
      // Put in front of the answer when it cuts the first line off.
      cutIns: ["Oh,", "Okay,", "Ah,"],
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
    hint: "Tap a circle to hear it.",
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
    } as Record<string, string>,
  },
  errors: {
    rate_limited: "Too many messages. Wait a moment.",
    unavailable: "The assistant is not available. Try again.",
    too_long: "That message is too long.",
    not_allowed: "I can't do that here.",
    expired: "That request expired. Ask again.",
    bad_request: "That recording didn't work. Try again.",
  },
}

export default messages
