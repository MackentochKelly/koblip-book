// The one place the live-speaking values live. The browser speaks
// through ElevenLabs Text to Dialogue directly with a one-time token;
// the API key never leaves the server.
export const VOICE_RULES = {
  // TTD socket base; the route adds model_id, output_format and the token.
  speakSocketUrl: "wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input",
  speakModel: "eleven_v4_turbo",
  // How long the account's voice list is kept before it is read again.
  accountVoicesCacheSeconds: 60 * 60,
  // Longest voice id a save accepts; ElevenLabs ids are 20 characters.
  maxVoiceIdLength: 64,
  // https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket
  speakSyncAlignment: true,
  speakOutputFormat: "pcm_24000",
  speakSampleRate: 24000,
  // Talking-live waveform analyser, ElevenLabs UI Live Waveform defaults
  // (https://ui.elevenlabs.io/docs/components/live-waveform).
  waveformFftSize: 256,
  waveformSmoothing: 0.8,
  // Token mint base; the route appends the type below.
  speakTokenUrl: "https://api.elevenlabs.io/v1/single-use-token/",
  // Proven by a live test on 2026-10-28: this type opens the TTD socket.
  // Not yet on the single-use token docs page (it lists only
  // realtime_scribe, batch_scribe and tts_websocket).
  speakTokenType: "ttd_websocket",
  // Speak-token mints per owner per minute.
  maxSpeakTokensPerMinutePerOwner: 30,
  // Talking mode: if nothing has been said this long after the owner
  // finished, say a short waiting line. A lookup says it at once. At most
  // one per answer.
  // ElevenLabs recommends 3 s for this "soft timeout":
  // https://elevenlabs.io/docs/agents-platform/customization/conversation-flow
  fillerAfterMs: 3000,
  // How long after the listening socket opens a hello may still be said;
  // later than this, talking just starts without one.
  greetingWaitMs: 6000,
  // The lines the AI writes for each talk (features/assistant/api/voice-lines.ts).
  // Each is said once at most, so these are also how many a talk can use.
  voiceLinesTimeoutMs: 15_000,
  voiceLinesMaxTokens: 4000,
  voiceLineCounts: { fillers: 10, cutIns: 6 },
  voiceLineMaxChars: { greeting: 80, filler: 40, cutIn: 16 },
} as const
