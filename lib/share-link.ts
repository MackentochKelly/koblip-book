// The phone's share sheet, or the link copied where there is none.
export async function shareLink({
  title,
  url,
}: {
  title: string
  url: string
}): Promise<"shared" | "copied" | "cancelled"> {
  try {
    if (navigator.share) {
      await navigator.share({ title, url })
      return "shared"
    }
    await navigator.clipboard.writeText(url)
    return "copied"
  } catch {
    // The share sheet was closed.
    return "cancelled"
  }
}
