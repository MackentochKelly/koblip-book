// iPhone Safari shows "AutoFill Contact" over the keyboard on any field it
// guesses is a name, phone, email or address, and ignores
// autocomplete="off" for it. It reads the field's `name` first, and a name
// with "search" in it is the one hint it is known to respect (no dashes:
// a dash in the name brings the contact suggestions back).
// (bytes.grubhub.com/disabling-safari-autofill-for-a-single-line-address-input-b83137b5b1c7,
// developer.apple.com/forums/thread/764041)
// Spread on every typing box. Passwords keep their own autoComplete, so
// saved passwords still work.
export function noAutofill(field: string) {
  return { name: `search_${field}`, autoComplete: "off" } as const
}
