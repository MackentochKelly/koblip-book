// The model name lives only in lib/meta-ai.ts (META_TEXT_MODEL).
export const ASSISTANT_RULES = {
  maxSteps: 8,
  maxMessageChars: 2000,
  maxHistoryMessages: 20,
  maxRequestsPerMinutePerOwner: 20,
  modelTimeoutMs: 60_000,
  maxCompletionTokens: 1024,
  // Shorter voice reasoning: https://dev.meta.ai/docs/reasoning
  reasoningEffort: "low",
  voiceReasoningEffort: "minimal",
  // Timeout for one answer check.
  answerCheckTimeoutMs: 20_000,
  // Choice buttons: how many options, and how long one option is.
  maxChoices: 6,
  maxChoiceChars: 60,
  // Longest customer search text the find_customer tool accepts.
  maxCustomerQuery: 80,
  // Widest free-times window the find_free_times tool answers at once.
  maxFreeTimesDays: 14,
  // Saved chats: how many the Recent list shows, and save limits.
  recentChats: 30,
  maxSavedMessages: 200,
  maxSavedMessageChars: 8000,
  maxChatTitleChars: 60,
  // Saved chats get their own per-minute budget, so saving never eats
  // the asking budget.
  maxChatRequestsPerMinutePerOwner: 60,
  // Live voice: session starts per owner per minute.
  maxVoiceSessionsPerMinutePerOwner: 6,
  // Live voice: longest one relay session, well under Meta's 60 minutes.
  maxVoiceSessionSeconds: 600,
  // Live voice: pre-handshake audio buffer, 5 s of 24 kHz 16-bit mono.
  voiceMaxBufferedBytes: 240_000,
  // Live voice: biggest one audio frame, 200 ms of 24 kHz 16-bit mono.
  voiceMaxFrameBytes: 9_600,
  // Stats ranges over this many days are refused (getBookingsBetween).
  maxStatsRangeDays: 366,
  // Total wall time for one chat request, model calls and tools together.
  maxRequestMs: 120_000,
} as const
