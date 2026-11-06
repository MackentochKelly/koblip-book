"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DownloadIcon } from "@/components/ui/icons"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { useAppInstall } from "@/hooks/use-app-install"
import { APP_NAME } from "@/lib/app-install"
import { InstallStepsPanel } from "./install-steps-panel"

// The Get the app widget: Koblip Book on the Home Screen. An Install button
// where the browser has one; on an iPhone or iPad, Show me how opens the
// steps, shown happening; nothing once it already runs as the app.
export function InstallAppCard() {
  const t = useTranslations("owner.widgets")
  const { way, install } = useAppInstall()
  const [steps, setSteps] = useState(false)
  if (way === "installed") return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Item variant="muted">
          <ItemMedia variant="image">
            <Image src="/apple-icon" alt="" width={40} height={40} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{APP_NAME}</ItemTitle>
            <ItemDescription>
              {way === "other" ? t("installElsewhere") : t("installLead")}
            </ItemDescription>
          </ItemContent>
        </Item>
        {way === "prompt" && (
          <Button className="md:self-start" onClick={() => void install()}>
            <DownloadIcon data-icon="inline-start" />
            {t("installButton")}
          </Button>
        )}
        {way === "ios" && (
          <>
            <Button className="md:self-start" onClick={() => setSteps(true)}>
              {t("installHowTo")}
            </Button>
            <InstallStepsPanel open={steps} onClose={() => setSteps(false)} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
