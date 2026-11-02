import Image from "next/image"

// "Continue with Google"'s look, the way Google's branding rules ask
// (developers.google.com/identity/branding-guidelines): Google's button
// colours on an outline Button, and Google's own "G" from its sign-in
// pack, unchanged. Shared by the real button and the home page's picture
// of it.
export const googleButtonClassName =
  "border-google-button-border bg-google-button text-google-button-foreground hover:bg-google-button hover:text-google-button-foreground dark:border-google-button-border dark:bg-google-button dark:hover:bg-google-button"

export function GoogleMark() {
  return (
    <>
      <Image
        src="/brands/google-g-light.png"
        alt=""
        width={20}
        height={20}
        unoptimized
        data-icon="inline-start"
        className="dark:hidden"
      />
      <Image
        src="/brands/google-g-dark.png"
        alt=""
        width={20}
        height={20}
        unoptimized
        data-icon="inline-start"
        className="hidden dark:block"
      />
    </>
  )
}
