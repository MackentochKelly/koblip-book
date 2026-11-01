// How a floating button that people can drag around the screen behaves.
export const DRAG_RULES = {
  // The spring that carries a dropped button to its corner; it keeps the
  // throw's speed, so a flick lands smoothly.
  snap: { type: "spring", stiffness: 500, damping: 40 },
  // How quickly a thrown button slows down, used to guess where a flick is
  // heading so it picks the corner it was thrown toward (iOS scroll rate).
  deceleration: 0.998,
  // Where each floating button's last corner is kept in the browser.
  storagePrefix: "koblip.float.",
} as const
