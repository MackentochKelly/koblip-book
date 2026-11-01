import "server-only"
import { cache } from "react"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { businessPolicies, businesses, translations } from "@/lib/db/schema"
import type { PageLanguage } from "@/lib/page-language"
import type { PolicyKind } from "@/lib/policy-rules"

export interface BusinessPolicy {
  business: { name: string; slug: string; isDemo: boolean }
  body: string
  updatedAt: string
}

// One of a business's policies for its page, or null when the business or
// the policy does not exist. Spanish uses the translation only while it was
// made from the current English text, like the rest of the page.
async function loadBusinessPolicy(
  slug: string,
  kind: PolicyKind,
  language: PageLanguage
): Promise<BusinessPolicy | null> {
  const [row] = await db
    .select({
      id: businessPolicies.id,
      body: businessPolicies.body,
      updatedAt: businessPolicies.updatedAt,
      name: businesses.name,
      isDemo: businesses.isDemo,
    })
    .from(businessPolicies)
    .innerJoin(businesses, eq(businesses.id, businessPolicies.businessId))
    .where(and(eq(businesses.slug, slug), eq(businessPolicies.kind, kind)))
    .limit(1)
  if (!row) {
    return null
  }
  let body = row.body
  if (language === "es") {
    const [translation] = await db
      .select({ sourceText: translations.sourceText, text: translations.text })
      .from(translations)
      .where(
        and(
          eq(translations.entityId, row.id),
          eq(translations.field, "policy.body"),
          eq(translations.language, "es")
        )
      )
      .limit(1)
    if (translation && translation.sourceText === row.body) {
      body = translation.text
    }
  }
  return {
    business: { name: row.name, slug, isDemo: row.isDemo },
    body,
    updatedAt: row.updatedAt,
  }
}

export const getBusinessPolicy = cache(loadBusinessPolicy)
