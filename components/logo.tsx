import { cn } from "@/lib/utils"

// The name as a wordmark: the "Koblip" logo drawing (public/koblip-logo.png),
// then "book" small after it, in Clash Display (Indian Type Foundry, from
// Fontshare: free for commercial use, fontshare.com/fonts/clash-display).
// The drawing is used as a mask, so it takes the text colour and follows
// light and dark mode. Its letters sit 22% above its bottom (the "p" hangs
// below), so it moves down by that much to line them up with "book".
const CLASH_DISPLAY =
  "https://api.fontshare.com/v2/css?display=swap&f[]=clash-display@500,600"

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-baseline gap-1 font-['Clash_Display'] text-2xl leading-none text-hero-foreground",
        className
      )}
    >
      <link rel="stylesheet" href={CLASH_DISPLAY} precedence="default" />
      <span
        role="img"
        aria-label="Koblip"
        className="inline-block aspect-[2008/612] h-[1.1em] translate-y-[0.24em] bg-current [mask:url(/koblip-logo.png)_center/contain_no-repeat]"
      />
      <span className="text-[0.55em] font-medium opacity-70">book</span>
    </span>
  )
}
