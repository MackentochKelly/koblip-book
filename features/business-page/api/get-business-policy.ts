import "server-only"
import { cache } from "react"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { businessPolicies, businesses, translations } from "@/lib/db/schema"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import { isPolicyKind } from "@/lib/policy-rules"

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
// Spanish uses a translation only while it was made from the current
// English text, like the rest of the page.
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
  let title = row.kind
    ? messagesFor(language).policies[row.kind]
    : (row.title ?? "")
  let body = row.body
  if (language === "es") {
    const rows = await db
      .select({
        field: translations.field,
        sourceText: translations.sourceText,
        text: translations.text,
      })
      .from(translations)
      .where(
        and(
          eq(translations.entityId, row.id),
          inArray(translations.field, ["policy.title", "policy.body"]),
          eq(translations.language, "es")
        )
      )
    for (const translation of rows) {
      if (
        translation.field === "policy.body" &&
        translation.sourceText === row.body
      ) {
        body = translation.text
      }
      if (
        !row.kind &&
        translation.field === "policy.title" &&
        translation.sourceText === row.title
      ) {
        title = translation.text
      }
    }
  }
  return {
    business: { name: row.name, slug, isDemo: row.isDemo },
    title,
    body,
    updatedAt: row.updatedAt,
  }
}

export const getBusinessPolicy = cache(loadBusinessPolicy)
