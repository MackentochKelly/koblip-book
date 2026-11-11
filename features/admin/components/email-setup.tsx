"use client"

import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import type { EmailSetup as Setup } from "../api/email"

// What sending email needs on the server (docs/plans/email.md, EM-11): the
// sender, Amazon's region and configuration set, and whether the keys are
// set. Never a key itself.
export function EmailSetup({ setup }: { setup: Setup }) {
  const t = useTranslations("admin.email.setup")
  const lines = [
    { key: "from", value: setup.from },
    { key: "region", value: setup.region },
    { key: "configurationSet", value: setup.configurationSet },
  ] as const
  return (
    <section className="flex flex-col gap-3" aria-labelledby="email-setup">
      <h2 id="email-setup" className="text-lg font-semibold tracking-tight">
        {t("title")}
      </h2>
      <ItemGroup className="gap-3">
        {lines.map((line) => (
          <Item key={line.key} variant="outline">
            <ItemContent className="min-w-0">
              <ItemTitle>{t(line.key)}</ItemTitle>
              <ItemDescription className="break-words">{line.value ?? t("notSet")}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>{t("keys")}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Badge variant={setup.keys ? "secondary" : "destructive"}>
              {setup.keys ? t("set") : t("notSet")}
            </Badge>
          </ItemActions>
        </Item>
      </ItemGroup>
    </section>
  )
}
