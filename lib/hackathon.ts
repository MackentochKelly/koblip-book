// The Meta Global AI Developer Hackathon Koblip Book was built for, as the
// home page's pill and its panel show it. Facts from the participant guide
// (cerebralvalley.ai/e/meta-ai-developer-hackathon/details) and the repo.
export const HACKATHON = {
  name: "Meta Global AI Developer Hackathon",
  // Kickoff to the submission deadline, and the repo's first commit.
  start: "2026-10-26",
  end: "2026-11-04",
  firstCommit: "2026-10-26",
  eventUrl: "https://cerebralvalley.ai/e/meta-ai-developer-hackathon",
  repoUrl: "https://github.com/MackentochKelly/koblip-book",
} as const

// Meta's model names as people read them (the API ids live in
// lib/meta-ai.ts, server only).
export const MUSE = {
  spark: "Muse Spark",
  voice: "Muse Voice Transcribe",
  image: "Muse Image",
} as const
