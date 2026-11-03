import * as Flags from "country-flag-icons/react/3x2"

// All the flags in one piece, so PhoneInput can load them on their own.
export default function PhoneFlag({ country }: { country: string }) {
  const Flag = Flags[country as keyof typeof Flags]
  return Flag ? <Flag aria-hidden className="h-4 w-6 rounded-sm" /> : null
}
