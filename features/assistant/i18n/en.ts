// The chat screen's words. The server writes its own lines (step chips,
// card titles); these are the ones the screen itself shows.
const messages = {
  title: "Assistant",
  back: "Back",
  newChat: "New chat",
  working: "Thinking…",
  retry: "Try again",
  // The one line that folds the assistant's steps.
  work: {
    done: (count: number) =>
      count === 1 ? "Checked 1 thing" : `Checked ${count} things`,
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
    },
  },
  composer: {
    placeholder: "Ask or tell me what to do",
    label: "Message",
    send: "Send",
    mic: "Speak",
    stop: "Stop",
    micDenied: "Allow the microphone to speak.",
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
