import "server-only"
import { getMetaAiClient, META_IMAGE_MODEL } from "@/lib/meta-ai"
import { STARTER_CATALOG_RULES as RULES } from "@/lib/starter-catalog-rules"
import { savePhoto } from "@/lib/uploads"
import { portraitLook } from "../utils/portrait-look"

export interface PortraitFacts {
  name: string
  // Their one line on the booking page: what they are good at.
  description: string | null
  category: string | null
  // Their place in the team list, which picks their look.
  position: number
}

// Built from saved facts only, never from text the browser sends.
export function portraitPrompt(facts: PortraitFacts): string {
  const work = facts.category?.toLowerCase() ?? "local business"
  const skill = facts.description ? ` (${facts.description})` : ""
  return `A friendly, natural headshot photo of ${facts.name}, ${portraitLook(facts.position)}, who works at a ${work}${skill}. Head and shoulders, centred, looking at the camera with a warm smile, wearing what people wear to work at a ${work}, soft daylight, softly blurred ${work} behind. Realistic photo, no text, no logos.`
}

// Draws one team member's photo with Muse Image and saves it like an
// uploaded photo. Returns its /uploads URL, or null when the AI is off or
// anything fails (the member keeps their initials).
export async function drawPortrait(
  facts: PortraitFacts,
  userId: string
): Promise<string | null> {
  const client = getMetaAiClient()
  if (!client) {
    return null
  }
  try {
    const response = await client.images.generate(
      {
        model: META_IMAGE_MODEL,
        prompt: portraitPrompt(facts),
        n: 1,
        size: RULES.imageSize,
        output_format: "webp",
        user: userId,
        // Meta's own fields, not in the OpenAI Images types
        // (dev.meta.ai/docs/image-generation): one pass and no lookups,
        // since a portrait needs no real-world facts.
        ...({
          reasoning_strength: "low",
          tool_enablement: {
            enable_image_search: false,
            enable_web_search: false,
            enable_shell: false,
          },
        } as object),
      },
      { timeout: RULES.imageTimeoutMs }
    )
    const base64 = response.data?.[0]?.b64_json
    if (!base64) {
      return null
    }
    const bytes = Buffer.from(base64, "base64")
    const saved = await savePhoto(
      new File([bytes], "portrait.webp", { type: "image/webp" })
    )
    return saved.ok ? saved.url : null
  } catch {
    console.error("drawPortrait: Meta AI request failed")
    return null
  }
}
