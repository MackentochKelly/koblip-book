import type { Metadata } from "next"
import Link from "next/link"

import { headerButtonClassName } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { XIcon } from "@/components/ui/icons"
import { claimBusiness } from "@/features/dashboard/api/actions"
import { AccountMenu } from "@/features/dashboard/components/account-menu"
import { StartScreen } from "@/features/dashboard/components/start-screen"
import {
  getOwnerLanguage,
  getOwnerMessages,
} from "@/features/dashboard/i18n/server"
import { GetStarted } from "@/features/onboarding/components/get-started"
import { requireAccount } from "@/lib/dal"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.businesses.add }
}

// Add business, from the menu's business switcher: the same Google Maps
// search as the first business; picking one opens its setup. ✕ goes back
// to the business the owner had open.
export default async function NewBusinessPage() {
  const owner = await requireAccount("/dashboard/new")
  const [m, language] = await Promise.all([
    getOwnerMessages(),
    getOwnerLanguage(),
  ])
  const t = m.shell.businesses
  return (
    <StartScreen
      language={language}
      title={t.addTitle}
      hint={t.addHint}
      action={
        <>
          <AccountMenu
            owner={{ name: owner.name, email: owner.email, image: owner.image }}
          />
          <Button
            variant="outline"
            size="icon"
            aria-label={t.back}
            title={t.back}
            className={headerButtonClassName}
            nativeButton={false}
            render={<Link href="/dashboard" />}
          >
            <XIcon />
          </Button>
        </>
      }
    >
      <GetStarted
        signedIn
        claim={claimBusiness}
        hint={false}
        language={language}
      />
    </StartScreen>
  )
}
