import { GiftIcon } from "@/components/ui/icons"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { useRewardWords } from "@/hooks/use-reward-words"
import type { RewardRule } from "@/lib/reward-rules"

// The rewards customers earn by booking here (docs/plans/rewards.md,
// RW-10): what they get, and what earns it.
export function BusinessRewards({
  rewards,
  currency,
}: {
  rewards: RewardRule[]
  currency: string
}) {
  const words = useRewardWords(currency)
  return (
    <ItemGroup className="gap-3">
      {rewards.map((rule) => (
        <Item key={rule.id} variant="outline">
          <ItemMedia variant="icon">
            <GiftIcon />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle>{words.prize(rule)}</ItemTitle>
            <ItemDescription>{words.earn(rule)}</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
}
