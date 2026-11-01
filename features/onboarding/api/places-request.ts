import "server-only"

const PLACES_API = "https://places.googleapis.com/v1"

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY
  if (!key) {
    throw new Error("GOOGLE_MAPS_PLATFORM_KEY is not set")
  }
  return key
}

// One POST to Places API (New), cut off after 5 seconds. A non-200 answer
// throws with Google's error message; callers decide what the UI sees.
// `fieldMask` is required by some methods (Text Search) and decides what
// Google bills.
export async function placesPost<T>(
  method: string,
  body: Record<string, unknown>,
  fieldMask?: string
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  let res: Response
  try {
    res = await fetch(`${PLACES_API}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey(),
        ...(fieldMask ? { "X-Goog-FieldMask": fieldMask } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Google Places request timed out")
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
  if (!res.ok) {
    let message = `Google Places request failed with status ${res.status}`
    try {
      const errorBody = (await res.json()) as {
        error?: { message?: string }
      }
      if (errorBody?.error?.message) {
        message = errorBody.error.message
      }
    } catch {
      // Keep the default message.
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}
