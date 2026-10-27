import { cn } from "@/lib/utils"

// The name as a wordmark: "koblip" at full size, "book" small after it, in
// Clash Display (Indian Type Foundry, from Fontshare: free for commercial
// use, fontshare.com/fonts/clash-display).
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
      <span className="font-semibold">koblip</span>
      <span className="text-[0.55em] font-medium opacity-70">book</span>
    </span>
  )
}
