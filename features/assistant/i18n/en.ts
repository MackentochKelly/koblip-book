// The chat screen's words. The server writes its own lines (step chips,
// card titles); these are the ones the screen itself shows.
const messages = {
  title: "Assistant",
  newChat: "New chat",
  working: "Working",
  retry: "Try again",
  empty: {
    title: "Ask me anything",
    example: "What is on today?",
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
