import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { PhoneIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import type { AdminMessages } from "../i18n"

export type KoblipNumberRow = {
  id: string
  number: string | null
  name: string | null
  quality: string | null
  accountReview: string | null
  active: boolean
  sending: boolean
}

// The WhatsApp numbers in Koblip's own workspace, as Chat lists them (A3):
// the one Book sends from, each number's name, Meta's quality rating and the
// account's review (a value Meta adds later is left out, never shown raw). Numbers are added in Koblip Chat itself.
export function KoblipNumbers({
  numbers,
  m,
}: {
  numbers: KoblipNumberRow[] | "unreachable"
  m: AdminMessages
}) {
  const t = m.koblipChat
  return (
    <section className="flex flex-col gap-3" aria-labelledby="koblip-numbers">
      <h2 id="koblip-numbers" className="text-lg font-semibold tracking-tight">
        {t.numbers}
      </h2>
      {numbers === "unreachable" ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t.unreachable}
        </p>
      ) : numbers.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PhoneIcon />
            </EmptyMedia>
            <EmptyTitle>{t.noNumbers}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {numbers.map((row) => (
            <Item key={row.id} variant="outline">
              <ItemContent className="min-w-0">
                <ItemTitle className="break-all">
                  {row.number ?? row.name ?? row.id}
                </ItemTitle>
                <ItemDescription className="break-words">
                  {[
                    row.number ? row.name : null,
                    row.quality ? t.quality[row.quality.toUpperCase()] : null,
                    row.accountReview
                      ? t.review[row.accountReview.toUpperCase()]
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                {row.sending && <Badge variant="secondary">{t.sending}</Badge>}
                {!row.active && (
                  <Badge variant="destructive">{t.inactive}</Badge>
                )}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </section>
  )
}
