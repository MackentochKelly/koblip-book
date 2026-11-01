"use client"

import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DownloadIcon,
  PlusSquareIcon,
  ShareUpIcon,
} from "@/components/ui/icons"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { useAppInstall } from "@/hooks/use-app-install"
import { APP_NAME } from "@/lib/app-install"
import { useOwnerMessages } from "../i18n/provider"

// The Get the app widget: Koblip Book on the Home Screen. An Install button
// where the browser has one, Share → Add to Home Screen on an iPhone or
// iPad, and nothing once it already runs as the app.
export function InstallAppCard() {
  const t = useOwnerMessages().widgets
  const { way, install } = useAppInstall()
  if (way === "installed") return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.names.install}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Item variant="muted">
          <ItemMedia variant="image">
            <Image src="/apple-icon" alt="" width={40} height={40} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{APP_NAME}</ItemTitle>
            <ItemDescription>
              {way === "other" ? t.installElsewhere : t.installLead}
            </ItemDescription>
          </ItemContent>
        </Item>
        {way === "prompt" && (
          <Button className="md:self-start" onClick={() => void install()}>
            <DownloadIcon data-icon="inline-start" />
            {t.installButton}
          </Button>
        )}
        {way === "ios" && (
          <ItemGroup>
            <Item size="sm">
              <ItemMedia variant="icon">
                <ShareUpIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{t.installShare}</ItemTitle>
              </ItemContent>
            </Item>
            <Item size="sm">
              <ItemMedia variant="icon">
                <PlusSquareIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{t.installAdd}</ItemTitle>
              </ItemContent>
            </Item>
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  )
}
