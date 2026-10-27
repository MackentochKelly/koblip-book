// What the owner types as a price, in minor units: "25" or "25.50" → 2550,
// "" → null (no price), anything else → undefined (not a price).
export function parsePrice(text: string): number | null | undefined {
  const value = text.trim()
  if (!value) return null
  if (!/^\d+([.,]\d{1,2})?$/.test(value)) return undefined
  return Math.round(Number(value.replace(",", ".")) * 100)
}
