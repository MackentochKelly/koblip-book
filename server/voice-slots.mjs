// Open live voice sessions per owner. Each costs a paid upstream session
// for up to maxVoiceSessionSeconds, so an owner may only keep a few open
// at once. Plain ESM like the relay, so the custom server can load it.

export function createVoiceSlots() {
  const open = new Map()

  // A release function for a free slot, or null when the owner already
  // has `max` open. Taken at once (no await between the count and the
  // take), so two upgrades at the same moment cannot both pass.
  const take = (ownerId, max) => {
    const count = open.get(ownerId) ?? 0
    if (count >= max) {
      return null
    }
    open.set(ownerId, count + 1)
    let released = false
    return () => {
      if (released) {
        return
      }
      released = true
      const left = (open.get(ownerId) ?? 1) - 1
      if (left > 0) {
        open.set(ownerId, left)
      } else {
        open.delete(ownerId)
      }
    }
  }

  return { take, count: (ownerId) => open.get(ownerId) ?? 0 }
}
