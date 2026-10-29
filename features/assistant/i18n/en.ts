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
    },
  },
  composer: {
    placeholder: "Ask or tell me what to do",
    label: "Message",
    send: "Send",
    mic: "Dictate",
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
      mute: "Mute",
      unmute: "Unmute",
      end: "End",
      // Said out loud when an answer waits for a tap on its card.
      confirmLine: "To do it, tap the button on the screen.",
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
  errors: {
    rate_limited: "Too many messages. Wait a moment.",
    unavailable: "The assistant is not available. Try again.",
    too_long: "That message is too long.",
    not_allowed: "I can't do that here.",
    expired: "That request expired. Ask again.",
    empty_audio: "I didn't hear anything. Try again.",
    bad_request: "That recording didn't work. Try again.",
  },
}

export default messages
