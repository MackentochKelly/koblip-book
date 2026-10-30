import type { Metadata } from "next"

import { HomeLookProvider } from "@/components/home-look"
import HomePage from "../page"

// A test of the home page with less colour (components/home-look.tsx), to
// compare with "/". Kept out of search. Remove once one look is picked.
export const metadata: Metadata = {
  title: "Koblip Book",
  robots: { index: false },
}

export default function CalmHomePage(props: PageProps<"/calm">) {
  return (
    <HomeLookProvider look="calm">
      <HomePage {...props} />
    </HomeLookProvider>
  )
}
