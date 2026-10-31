// How long ago, in the largest unit that fits ("3 minutes ago").
export function formatAgo(iso: string, now: number, locale: string) {
  const seconds = Math.round((Date.parse(iso) - now) / 1000)
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const units = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ] as const
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size)
      return format.format(Math.round(seconds / size), unit)
  }
  return format.format(seconds, "second")
}
