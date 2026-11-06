import { relations, sql } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

// Customers' own sign-in (lib/customer-auth.ts): Better Auth's four core
// tables (better-auth.com/docs/concepts/database#core-schema) plus its
// phone-number plugin's two fields, kept apart from the owners' tables so a
// customer never holds an owner's session and an owner's phone sign-in can
// never open the dashboard. One row per verified phone number.

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`

export const customerUser = sqliteTable("customer_user", {
  id: text("id").primaryKey(),
  // The name from the customer's latest booking.
  name: text("name").notNull(),
  // Better Auth needs an email; customers sign in by phone only, so it is
  // a placeholder on a reserved domain (RFC 2606), never mailed.
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(now)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(now)
    .$onUpdate(() => new Date())
    .notNull(),
  // Phone-number plugin (better-auth.com/docs/plugins/phone-number), as
  // +18095550123, the same form bookings keep.
  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: integer("phone_number_verified", { mode: "boolean" }),
})

export const customerSession = sqliteTable(
  "customer_session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(now)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => customerUser.id, { onDelete: "cascade" }),
  },
  (table) => [index("customer_session_user_idx").on(table.userId)]
)

export const customerAccount = sqliteTable(
  "customer_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => customerUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(now)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("customer_account_user_idx").on(table.userId)]
)

// The sign-in codes while they wait, each for a few minutes.
export const customerVerification = sqliteTable(
  "customer_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(now)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(now)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("customer_verification_identifier_idx").on(table.identifier),
  ]
)

export const customerUserRelations = relations(customerUser, ({ many }) => ({
  sessions: many(customerSession),
  accounts: many(customerAccount),
}))

export const customerSessionRelations = relations(
  customerSession,
  ({ one }) => ({
    user: one(customerUser, {
      fields: [customerSession.userId],
      references: [customerUser.id],
    }),
  })
)

export const customerAccountRelations = relations(
  customerAccount,
  ({ one }) => ({
    user: one(customerUser, {
      fields: [customerAccount.userId],
      references: [customerUser.id],
    }),
  })
)
