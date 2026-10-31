"use client"

import { Button } from "@/components/ui/button"

// A phone page's main action as a round button floating at the bottom
// right, just above the tab bar, so it stays in reach of the thumb while the
// page scrolls. Hidden on a computer, where the page's header holds it.
// Put it last on the page: it leaves room at the foot so the button never
// hides the last item.
export function FloatingActionButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <>
      <div aria-hidden className="h-10 md:hidden" />
      <Button
        size="icon-lg"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        // 48 px, with the same soft 2 px ring as the tab bar's middle button.
        className="fixed right-4 bottom-[calc(--spacing(20)+env(safe-area-inset-bottom))] z-30 size-12 rounded-full border-2 border-primary-foreground/45 bg-clip-border md:hidden [&_svg:not([class*='size-'])]:size-6"
      >
        {children}
      </Button>
    </>
  )
}
