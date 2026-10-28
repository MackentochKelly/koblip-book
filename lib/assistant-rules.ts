// The model name lives only in lib/meta-ai.ts (META_TEXT_MODEL).
export const ASSISTANT_RULES = {
  maxSteps: 8,
  maxMessageChars: 2000,
  maxHistoryMessages: 20,
  maxRequestsPerMinutePerOwner: 20,
  modelTimeoutMs: 60_000,
  maxCompletionTokens: 1024,
  // Total wall time for one chat request, model calls and tools together.
  maxRequestMs: 120_000,
  // Voice transcription. The UI imports these so the browser records
  // exactly what the server accepts; nothing is repeated elsewhere.
  maxTranscribeSeconds: 60,
  // The sample rate the browser sends. The server also accepts 24000.
  transcribeSampleRate: 16000,
  // 60 s at 24 kHz mono 16-bit is ~2.9 MB; this leaves header headroom.
  maxTranscribeBytes: 4_194_304,
  maxTranscribesPerMinutePerOwner: 10,
} as const
