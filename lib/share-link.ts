// The phone's share sheet, or the link (with its text) copied where there is
// none.
export async function shareLink({
  title,
  text,
  url,
}: {
  title: string
  text?: string
  url: string
}): Promise<"shared" | "copied" | "cancelled"> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url })
      return "shared"
    }
    await navigator.clipboard.writeText(text ? `${text}\n${url}` : url)
    return "copied"
  } catch {
    // The share sheet was closed.
    return "cancelled"
  }
}
