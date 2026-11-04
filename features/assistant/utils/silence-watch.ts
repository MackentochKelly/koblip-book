import { VOICE_RULES } from "@/lib/voice-rules"

// Tells when the owner has gone quiet, from the microphone's loudness. Calls
// `onQuiet` once per stretch of sound, after the set wait. A wrong call costs
// little (the answer is taken back when more words come), and a room too loud
// to ever read as quiet just waits for Meta's final words, as before.
export function createSilenceWatch(onQuiet: () => void) {
  // The room's own level: follows the quietest moments, and creeps up so a
  // steady noise stops counting as the owner.
  let room = Number.POSITIVE_INFINITY
  let lastVoiceAt: number | null = null
  let told = true

  return {
    // One reading of audioLevel (lib/audio-level.ts), and when it was taken.
    hear(level: number, at: number) {
      room =
        level < room ? level : room + (level - room) * VOICE_RULES.roomLevelRise
      const loud =
        level >= VOICE_RULES.minVoiceLevel &&
        level >= room * VOICE_RULES.voiceOverRoom
      if (loud) {
        lastVoiceAt = at
        told = false
      } else if (
        !told &&
        lastVoiceAt !== null &&
        at - lastVoiceAt >= VOICE_RULES.earlyAnswerAfterQuietMs
      ) {
        told = true
        onQuiet()
      }
    },
    lastVoiceAt: () => lastVoiceAt,
  }
}
