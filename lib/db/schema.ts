import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

function timestamps() {
  return {
    createdAt: text()
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text()
      .notNull()
      .$defaultFn(() => new Date().toISOString())
      .$onUpdate(() => new Date().toISOString()),
  }
}

function id() {
  return text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())
}

export const businesses = sqliteTable("businesses", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text(),
  phone: text(),
  address: text(),
  timezone: text().notNull(),
  currency: text().notNull(),
  googlePlaceId: text().unique(),
  category: text(),
  rating: real(),
  reviewCount: integer(),
  website: text(),
  latitude: real(),
  longitude: real(),
  mapsUrl: text(),
  status: text(),
  ...timestamps(),
})

export const businessHours = sqliteTable(
  "business_hours",
  {
    id: id(),
    businessId: text()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    weekday: integer().notNull(),
    opensAt: text().notNull(),
    closesAt: text().notNull(),
    ...timestamps(),
  },
  (table) => [
    index("business_hours_business_idx").on(table.businessId, table.weekday),
  ]
)

export const services = sqliteTable(
  "services",
  {
    id: id(),
    businessId: text()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text(),
    durationMinutes: integer().notNull(),
    priceMinor: integer(),
    position: integer().notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    index("services_business_idx").on(table.businessId, table.position),
  ]
)

export const teamMembers = sqliteTable(
  "team_members",
  {
    id: id(),
    businessId: text()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text().notNull(),
    photoUrl: text(),
    position: integer().notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    index("team_members_business_idx").on(table.businessId, table.position),
  ]
)

export const businessPhotos = sqliteTable(
  "business_photos",
  {
    id: id(),
    businessId: text()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    url: text().notNull(),
    position: integer().notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    index("business_photos_business_idx").on(table.businessId, table.position),
  ]
)
