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
  // Talking mode: this long after the owner's last sound, with words already
  // heard, the answer starts without waiting for Meta to call the turn done.
  // Measured on real talks: Meta's final words for a full sentence come within
  // about 850 ms, so a sentence never starts early on half its words, while a
  // short phrase, which Meta holds for over 3 s, saves more than 2 s.
  earlyAnswerAfterQuietMs: 900,
  // What counts as the owner's sound: audioLevel at least this, and this many
  // times the room's own level. The room's level follows the quietest moments
  // and creeps up by this share per reading, so a steady noise stops counting.
  minVoiceLevel: 0.03,
  voiceOverRoom: 3,
  roomLevelRise: 0.0005,
  // Timing reports per owner per minute (numbers only, for the server log).
  maxTimingReportsPerMinutePerOwner: 60,
  // How long after the listening socket opens a hello may still be said;
  // later than this, talking just starts without one.
  greetingWaitMs: 6000,
  // The lines the AI writes for each talk (features/assistant/api/voice-lines.ts).
  // Each is said once at most, so these are also how many a talk can use.
  voiceLinesTimeoutMs: 15_000,
  voiceLinesMaxTokens: 4000,
  voiceLineCounts: { cutIns: 6 },
  voiceLineMaxChars: { greeting: 80, cutIn: 16 },
} as const
