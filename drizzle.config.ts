import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./data/koblip-book.db",
  },
})
