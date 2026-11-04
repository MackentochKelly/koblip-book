import type { VoiceTiming } from "./live-voice-session"

// Where one answer's time went (POST /api/voice/timing). Numbers only, and a
// failed report changes nothing in the talk.
export function sendVoiceTiming(businessId: string, timing: VoiceTiming) {
  void fetch("/api/voice/timing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId, ...timing }),
    keepalive: true,
  }).catch(() => {})
}
