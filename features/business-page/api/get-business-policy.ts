import "server-only"
import { cache } from "react"
import { and, eq, isNull } from "drizzle-orm"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { businessPolicies, businesses } from "@/lib/db/schema"
import type { PageLanguage } from "@/lib/page-language"
import { isPolicyKind } from "@/lib/policy-rules"
import { getBusinessTranslations } from "@/lib/translations/business-texts"

export interface BusinessPolicy {
  business: { name: string; slug: string; isDemo: boolean }
  // A standard one's name in the page's words, or the owner's own title.
  title: string
  body: string
  updatedAt: string
}

// One of a business's policies for its page, by its address
// (lib/policy-rules' policySegment): a standard kind, or the id of one of
// the owner's own. Null when the business or the policy does not exist.
// In another language, a translation shows only while it was made from the
// current English, like the rest of the page.
async function loadBusinessPolicy(
  slug: string,
  segment: string,
  language: PageLanguage
): Promise<BusinessPolicy | null> {
  const [row] = await db
    .select({
      id: businessPolicies.id,
      kind: businessPolicies.kind,
      title: businessPolicies.title,
      body: businessPolicies.body,
      updatedAt: businessPolicies.updatedAt,
      businessId: businesses.id,
      name: businesses.name,
      isDemo: businesses.isDemo,
    })
    .from(businessPolicies)
    .innerJoin(businesses, eq(businesses.id, businessPolicies.businessId))
    .where(
      and(
        eq(businesses.slug, slug),
        isPolicyKind(segment)
          ? eq(businessPolicies.kind, segment)
          : and(eq(businessPolicies.id, segment), isNull(businessPolicies.kind))
      )
    )
    .limit(1)
  if (!row) {
    return null
  }
  const translated = await getBusinessTranslations(row.businessId, language)
  const policies = await getTranslations({
    locale: language,
    namespace: "public.policies",
  })
  const title = row.kind
    ? policies(row.kind)
    : row.title
      ? translated(row.id, "policy.title", row.title)
      : ""
  const body = translated(row.id, "policy.body", row.body)
  return {
    business: { name: row.name, slug, isDemo: row.isDemo },
    title,
    body,
    updatedAt: row.updatedAt,
  }
}

export const getBusinessPolicy = cache(loadBusinessPolicy)
