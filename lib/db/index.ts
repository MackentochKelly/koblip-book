import "server-only"
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import * as schema from "./schema"

function createDb() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.")
  }
  return drizzle(createClient({ url }), { schema, casing: "snake_case" })
}

export type Database = ReturnType<typeof createDb>

let instance: Database | undefined

function getDb(): Database {
  if (!instance) {
    instance = createDb()
  }
  return instance
}

// Created lazily on first query so that importing this module never touches
// the database. This keeps `next build` working without DATABASE_URL set.
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver)
  },
})
