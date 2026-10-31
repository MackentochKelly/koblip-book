"use client"

import { AnimatePresence, motion } from "motion/react"

// One thing swapping for another in the same spot, like the tab bar's
// middle button (the assistant ✦ or a page's +): the old one turns away and
// shrinks out while the new one turns in with a small bounce. A new `swapKey`
// starts the swap; nothing moves on the first show. With Reduce Motion on
// (MotionProvider) it only fades. The parent needs `relative`.
export function SpinSwap({
  swapKey,
  children,
}: {
  swapKey: string
  children: React.ReactNode
}) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={swapKey}
        className="flex"
        initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
        transition={{
          type: "spring",
          duration: 0.35,
          bounce: 0.4,
          // Fades never bounce.
          opacity: { duration: 0.15, ease: "easeOut" },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
