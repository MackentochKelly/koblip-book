// One customer across bookings: the phone's digits, or the name (lower
// case, single spaces) when there is no phone. Stored on each booking as
// customer_key, so the Customers page can group in the database.
export function customerKey(phone: string | null, name: string): string {
  const digits = (phone ?? "").replace(/\D/g, "")
  if (digits.length > 0) {
    return `p:${digits}`
  }
  return `n:${name.trim().toLowerCase().replace(/\s+/g, " ")}`
}

// A customer shown by their key alone, when there is no booking or saved
// name to read: the phone ("+18095550123") or the name it was made from.
export function customerKeyLabel(key: string): string {
  return key.startsWith("p:") ? `+${key.slice(2)}` : key.slice(2)
}
