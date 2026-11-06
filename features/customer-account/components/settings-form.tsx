"use client"

import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

import { THEMES, useSignOut } from "@/components/account-menu"
import { AppSelect } from "@/components/app-select"
import { useOwnerLanguage } from "@/components/app-language"
import { DeleteAccountSection } from "@/components/delete-account-section"
import { PageSection } from "@/components/page-section"
import { Button } from "@/components/ui/button"
import { LanguagesIcon, LogOutIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { ACCOUNT_SETTINGS_PATH } from "@/lib/my-bookings-links"
import {
  isPageLanguage,
  LANGUAGE_NAMES,
  PAGE_LANGUAGES,
} from "@/lib/page-language"
import { deleteClientAccount } from "../api/delete-account"

const noChanges = () => () => {}

// The client's Settings: light or dark and the language (the same choices
// as the account menu), log out, their bell's choices (`notifications`),
// and delete the account.
export function SettingsForm({
  contact,
  notifications,
}: {
  contact: string
  notifications?: React.ReactNode
}) {
  const shell = useTranslations("owner.shell")
  const t = useTranslations("public.account.settings")
  const { theme, setTheme } = useTheme()
  // The theme is known only in the browser (next-themes).
  const mounted = useSyncExternalStore(
    noChanges,
    () => true,
    () => false
  )
  // Until then it shows "System", the same as the server did.
  const current =
    (mounted && THEMES.find((item) => item.value === theme)) || THEMES[2]
  const [language, setLanguage] = useOwnerLanguage()
  const signOut = useSignOut()
  return (
    <div className="flex flex-col gap-10">
      <PageSection id="look" title={t("look")}>
        <ItemGroup className="gap-3">
          <Item variant="box">
            <ItemMedia variant="icon">
              <current.icon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{shell("appearance")}</ItemTitle>
            </ItemContent>
            <ItemActions>
              <AppSelect
                aria-label={shell("appearance")}
                value={mounted ? current.value : null}
                onValueChange={setTheme}
                options={THEMES.map((item) => ({
                  value: item.value,
                  label: shell(item.key),
                  icon: <item.icon />,
                }))}
              />
            </ItemActions>
          </Item>
          <Item variant="box">
            <ItemMedia variant="icon">
              <LanguagesIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{shell("language")}</ItemTitle>
            </ItemContent>
            <ItemActions>
              <AppSelect
                aria-label={shell("language")}
                value={language}
                onValueChange={(next) => {
                  if (isPageLanguage(next)) setLanguage(next)
                }}
                options={PAGE_LANGUAGES.map((code) => ({
                  value: code,
                  label: LANGUAGE_NAMES[code],
                }))}
              />
            </ItemActions>
          </Item>
          <Item variant="box">
            <ItemMedia variant="icon">
              <LogOutIcon />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="max-w-full">
                <span className="truncate">{contact}</span>
              </ItemTitle>
            </ItemContent>
            <ItemActions>
              <Button variant="outline" onClick={() => void signOut()}>
                {shell("signOut")}
              </Button>
            </ItemActions>
          </Item>
        </ItemGroup>
      </PageSection>
      {notifications}
      <DeleteAccountSection
        contact={contact}
        returnTo={ACCOUNT_SETTINGS_PATH}
        deleteAccount={deleteClientAccount}
        hint={t("deleteHint")}
        confirmText={t("confirmText")}
        ownerError={t("ownsBusiness")}
      />
    </div>
  )
}
