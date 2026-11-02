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
  // Choice buttons: how many options (a full day of 15-minute times; the
  // screen shows the first 6 and "N more"), and how long one option is.
  maxChoices: 48,
  maxChoiceChars: 60,
  // Longest customer search text the find_customer tool accepts.
  maxCustomerQuery: 80,
  // Widest free-times window the find_free_times tool answers at once.
  maxFreeTimesDays: 14,
  // Cards waiting for the owner's tap: how long one lives, and how many
  // one owner may have waiting.
  pendingActionExpiresMs: 10 * 60_000,
  maxPendingActionsPerOwner: 10,
  // Memory: records one answer keeps for the next question, and how many
  // of the newest answers' records the model sees.
  maxMemoryRows: 30,
  maxMemoryReplies: 3,
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
  // Live voice: sessions one owner may keep open at once (each is a paid
  // upstream session).
  maxOpenVoiceSessionsPerOwner: 2,
  // Live voice: longest one relay session, well under Meta's 60 minutes.
  maxVoiceSessionSeconds: 600,
  // Live voice: pre-handshake audio buffer, 5 s of 24 kHz 16-bit mono.
  voiceMaxBufferedBytes: 240_000,
  // Live voice: biggest one audio frame, 200 ms of 24 kHz 16-bit mono.
  voiceMaxFrameBytes: 9_600,
  // Stats ranges over this many days are refused (getBookingsBetween).
  maxStatsRangeDays: 366,
  // Typed answers: words held back until this many have come (and a
  // sentence has ended), so a short line written before a tool call never
  // shows. Longer answers stream from there.
  typedHoldChars: 160,
  // Total wall time for one chat request, model calls and tools together.
  maxRequestMs: 120_000,
  // How long after a page load the floating globe shows its ideas.
  floatIdeasMs: 20_000,
  // They come and leave one by one: how long each takes to fade, and how long
  // after one starts the next does.
  floatIdeasFadeInMs: 2000,
  floatIdeasFadeInGapMs: 1000,
  floatIdeasFadeOutMs: 2600,
  floatIdeasFadeOutGapMs: 1300,
} as const
