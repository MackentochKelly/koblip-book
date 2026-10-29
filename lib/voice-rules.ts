// The one place the live-speaking values live. The browser speaks
// through ElevenLabs Text to Dialogue directly with a one-time token;
// the API key never leaves the server.
export const VOICE_RULES = {
  // TTD socket base; the route adds model_id, output_format and the token.
  speakSocketUrl: "wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input",
  speakModel: "eleven_v4_turbo",
  // Savvy, warm and steady, English and Spanish. A picker comes later.
  speakVoiceId: "ogwqBH5bbF03DSbNiRNN",
  speakOutputFormat: "pcm_24000",
  speakSampleRate: 24000,
  // Token mint base; the route appends the type below.
  speakTokenUrl: "https://api.elevenlabs.io/v1/single-use-token/",
  // Proven by a live test on 2026-10-28: this type opens the TTD socket.
  // Not yet on the single-use token docs page (it lists only
  // realtime_scribe, batch_scribe and tts_websocket).
  speakTokenType: "ttd_websocket",
  // Speak-token mints per owner per minute.
  maxSpeakTokensPerMinutePerOwner: 30,
  // Talking mode: if nothing has been said this long after the owner
  // finished, say a short line ("Hmm, let me see."), once per turn.
  // ElevenLabs recommends 3 s for this "soft timeout":
  // https://elevenlabs.io/docs/agents-platform/customization/conversation-flow
  fillerAfterMs: 3000,
} as const
