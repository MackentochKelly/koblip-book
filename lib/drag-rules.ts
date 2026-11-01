// How a floating button that people can drag around the screen behaves.
export const DRAG_RULES = {
  // The spring that carries a dropped button to the nearest side of the
  // screen; it keeps the throw's speed, so a flick lands smoothly.
  snap: { type: "spring", stiffness: 500, damping: 40 },
  // Where each floating button's last spot is kept in the browser.
  storagePrefix: "koblip.float.",
} as const
