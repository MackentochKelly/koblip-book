import type { Metadata } from "next"

import { HomeLookProvider } from "@/components/home-look"
import HomePage from "../page"

// A test of the home page with less colour ("glow" in components/home-look.tsx), to
// compare with "/". Kept out of search. Remove once one look is picked.
export const metadata: Metadata = {
  title: "Koblip Book",
  robots: { index: false },
}

export default function GlowHomePage(props: PageProps<"/glow">) {
  return (
    <HomeLookProvider look="glow">
      <HomePage {...props} />
    </HomeLookProvider>
  )
}
