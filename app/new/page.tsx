import type { Metadata } from "next"

import { HomeLookProvider } from "@/components/home-look"
import HomePage from "../page"

// A test of the home page in bands ("bands" in components/home-look.tsx), to
// compare with "/". Kept out of search. Remove once one look is picked.
export const metadata: Metadata = {
  title: "Koblip Book",
  robots: { index: false },
}

export default function BandsHomePage(props: PageProps<"/new">) {
  return (
    <HomeLookProvider look="bands">
      <HomePage {...props} />
    </HomeLookProvider>
  )
}
